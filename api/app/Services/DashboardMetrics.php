<?php

namespace App\Services;

use App\Enums\AuditType;
use App\Enums\SubmissionStatus;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Services\Manual\ManualExtractionService;
use App\Services\Security\SubmissionAttempts;
use App\Support\LocalDay;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use stdClass;

/**
 * Números do painel inicial da moderação. Só consultas agregadas, sem cache: cada
 * abertura do painel lê o estado de agora. Dias são os do fuso de exibição (LocalDay), como a cota
 * diária da IA: o banco grava em UTC e o agrupamento converte.
 */
class DashboardMetrics
{
    public const WINDOW_DAYS = 30;

    /** Eventos que contam como tentativa barrada de um IP. */
    private const SUSPICIOUS_TYPES = ['submission_refused', 'bot_blocked', 'manual_blocked'];

    public function __construct(private readonly ManualExtractionService $manual) {}

    /**
     * Envios criados por dia, do mais antigo ao mais recente, com dias vazios em 0.
     *
     * @return array<string, int> `Y-m-d` => total
     */
    public function submissionsPerDay(int $days = self::WINDOW_DAYS): array
    {
        $counts = DriverSubmission::query()
            ->where('created_at', '>=', $this->windowStart($days))
            ->selectRaw(LocalDay::createdDateSql()[0].' as day, COUNT(*) as total', LocalDay::createdDateSql()[1])
            ->groupBy('day')
            ->pluck('total', 'day');

        return $this->fillDays($counts->all(), $days);
    }

    /** @return array{pending: int, approved: int, rejected: int} */
    public function submissionsByStatus(): array
    {
        $counts = DriverSubmission::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return [
            'pending' => (int) ($counts[SubmissionStatus::Pending->value] ?? 0),
            'approved' => (int) ($counts[SubmissionStatus::Approved->value] ?? 0),
            'rejected' => (int) ($counts[SubmissionStatus::Rejected->value] ?? 0),
        ];
    }

    /** Aprovados ÷ (aprovados + rejeitados), de 0 a 1; `null` quando ainda não houve decisão. */
    public function approvalRate(): ?float
    {
        $status = $this->submissionsByStatus();
        $decided = $status['approved'] + $status['rejected'];

        return $decided === 0 ? null : $status['approved'] / $decided;
    }

    public function pending(): int
    {
        return $this->submissionsByStatus()['pending'];
    }

    public function driversTotal(): int
    {
        return Driver::query()->count();
    }

    /**
     * Uso da leitura de manual por IA, hoje e nos últimos 30 dias. A cota consumida vem dos eventos
     * `manual_read` que contaram para o teto (`quota_counted`) no dia local corrente (LocalDay).
     *
     * @return array{
     *     enabled: bool,
     *     today: array{reads: int, failures: int, blocked: int},
     *     days30: array{reads: int, failures: int, blocked: int},
     *     quota_used: int,
     *     quota_cap: int,
     *     quota_percent: float|null
     * }
     */
    public function manualUsage(): array
    {
        $today = LocalDay::key();
        $todayTotals = ['reads' => 0, 'failures' => 0, 'blocked' => 0];
        $windowTotals = ['reads' => 0, 'failures' => 0, 'blocked' => 0];

        foreach ($this->manualRows(self::WINDOW_DAYS) as $row) {
            $bucket = $this->bucket((string) $row->type, $row->outcome === null ? null : (string) $row->outcome);
            if ($bucket === null) {
                continue;
            }
            $windowTotals[$bucket] += (int) $row->total;
            if ($row->day === $today) {
                $todayTotals[$bucket] += (int) $row->total;
            }
        }

        $used = AuditEvent::query()
            ->where('type', AuditType::ManualRead)
            ->where('quota_counted', true)
            ->where('created_at', '>=', LocalDay::startUtc())
            ->count();
        $cap = (int) config('manual_extraction.daily_cap');

        return [
            'enabled' => $this->manual->enabled(),
            'today' => $todayTotals,
            'days30' => $windowTotals,
            'quota_used' => $used,
            'quota_cap' => $cap,
            'quota_percent' => $cap > 0 ? round($used / $cap * 100, 1) : null,
        ];
    }

    /**
     * Leituras de manual por dia, três séries (ok, falha, bloqueio), com dias vazios em 0.
     *
     * @return array{ok: array<string, int>, failed: array<string, int>, blocked: array<string, int>}
     */
    public function manualReadsPerDay(int $days = self::WINDOW_DAYS): array
    {
        $series = ['ok' => [], 'failed' => [], 'blocked' => []];
        $keys = ['reads' => 'ok', 'failures' => 'failed', 'blocked' => 'blocked'];

        foreach ($this->manualRows($days) as $row) {
            $bucket = $this->bucket((string) $row->type, $row->outcome === null ? null : (string) $row->outcome);
            if ($bucket !== null) {
                $name = $keys[$bucket];
                $series[$name][$row->day] = ($series[$name][$row->day] ?? 0) + (int) $row->total;
            }
        }

        return [
            'ok' => $this->fillDays($series['ok'], $days),
            'failed' => $this->fillDays($series['failed'], $days),
            'blocked' => $this->fillDays($series['blocked'], $days),
        ];
    }

    /**
     * Tentativas de envio público por dia: aceitos, recusados (limite, validação, duplicata) e
     * barrados pelo anti-robô, com dias vazios em 0.
     *
     * @return array{accepted: array<string, int>, refused: array<string, int>, bot: array<string, int>}
     */
    public function submissionAttemptsPerDay(int $days = self::WINDOW_DAYS): array
    {
        $types = [
            AuditType::SubmissionReceived->value => 'accepted',
            AuditType::SubmissionRefused->value => 'refused',
            AuditType::BotBlocked->value => 'bot',
        ];
        $series = ['accepted' => [], 'refused' => [], 'bot' => []];

        $rows = AuditEvent::query()
            ->whereIn('type', array_keys($types))
            // O início de um bloqueio por abuso não é uma tentativa, só a consequência delas.
            ->where(fn ($query) => $query->whereNull('reason')->orWhere('reason', '!=', SubmissionAttempts::REASON_ABUSE))
            ->where('created_at', '>=', $this->windowStart($days))
            ->selectRaw(LocalDay::createdDateSql()[0].' as day, type, COUNT(*) as total', LocalDay::createdDateSql()[1])
            ->groupBy('day', 'type')
            ->toBase()
            ->get();

        foreach ($rows as $row) {
            $series[$types[(string) $row->type]][(string) $row->day] = (int) $row->total;
        }

        return array_map(fn (array $counts): array => $this->fillDays($counts, $days), $series);
    }

    /**
     * Resumo das últimas 24 h para os cartões de segurança.
     *
     * @return array{accepted: int, refused: int, bot: int, abuse_blocks: int, reasons: array<string, int>, suspicious_ips: int}
     */
    public function submissionAttemptsLastDay(): array
    {
        $since = now()->subDay();
        $types = [AuditType::SubmissionReceived->value, AuditType::SubmissionRefused->value, AuditType::BotBlocked->value];

        $rows = AuditEvent::query()
            ->whereIn('type', $types)
            ->where('created_at', '>=', $since)
            ->selectRaw('type, reason, COUNT(*) as total')
            ->groupBy('type', 'reason')
            ->toBase()
            ->get();

        $summary = ['accepted' => 0, 'refused' => 0, 'bot' => 0, 'abuse_blocks' => 0, 'reasons' => []];

        foreach ($rows as $row) {
            $total = (int) $row->total;
            $reason = $row->reason === null ? null : (string) $row->reason;

            if ($row->type === AuditType::SubmissionReceived->value) {
                $summary['accepted'] += $total;
            } elseif ($reason === SubmissionAttempts::REASON_ABUSE) {
                $summary['abuse_blocks'] += $total;
            } elseif ($row->type === AuditType::SubmissionRefused->value) {
                $summary['refused'] += $total;
                $summary['reasons'][(string) $reason] = ($summary['reasons'][(string) $reason] ?? 0) + $total;
            } elseif ($row->type === AuditType::BotBlocked->value) {
                $summary['bot'] += $total;
            }
        }

        $summary['suspicious_ips'] = $this->suspicious()
            ->where('created_at', '>=', $since)
            ->whereNotNull('ip_address')
            ->distinct()
            ->count('ip_address');

        return $summary;
    }

    /**
     * IPs com mais tentativas barradas (anti-robô, recusa, leitura de manual bloqueada) no período,
     * do mais insistente ao menos.
     *
     * @return list<array{ip: string, attempts: int, last_seen: string}>
     */
    public function suspiciousIps(int $days = 7, int $limit = 10): array
    {
        $rows = $this->suspicious()
            ->where('created_at', '>=', now()->subDays($days))
            ->whereNotNull('ip_address')
            ->selectRaw('ip_address, COUNT(*) as attempts, MAX(created_at) as last_seen')
            ->groupBy('ip_address')
            ->orderByDesc('attempts')
            ->orderByDesc('last_seen')
            ->limit($limit)
            ->toBase()
            ->get()
            ->map(fn (stdClass $row): array => [
                'ip' => (string) $row->ip_address,
                'attempts' => (int) $row->attempts,
                'last_seen' => (string) $row->last_seen,
            ])
            ->all();

        return array_values($rows);
    }

    /** @return Builder<AuditEvent> tentativas barradas, sem o driver repetido (engano de gente de verdade) */
    private function suspicious(): Builder
    {
        return AuditEvent::query()
            ->whereIn('type', self::SUSPICIOUS_TYPES)
            ->where(fn (Builder $query) => $query
                ->whereNull('reason')
                ->orWhere('reason', '!=', SubmissionAttempts::REASON_DUPLICATE));
    }

    /** @return Collection<int, stdClass> */
    private function manualRows(int $days): Collection
    {
        return AuditEvent::query()
            ->whereIn('type', [AuditType::ManualRead->value, AuditType::ManualBlocked->value])
            ->where('created_at', '>=', $this->windowStart($days))
            ->selectRaw(LocalDay::createdDateSql()[0].' as day, type, outcome, COUNT(*) as total', LocalDay::createdDateSql()[1])
            ->groupBy('day', 'type', 'outcome')
            ->toBase()
            ->get();
    }

    /** @return 'reads'|'failures'|'blocked'|null */
    private function bucket(string $type, ?string $outcome): ?string
    {
        if ($type === AuditType::ManualBlocked->value) {
            return 'blocked';
        }

        return match ($outcome) {
            'ok' => 'reads',
            'failed' => 'failures',
            default => null,
        };
    }

    private function windowStart(int $days): DateTimeInterface
    {
        return LocalDay::startUtc($days - 1);
    }

    /**
     * @param  array<string, int|string>  $counts
     * @return array<string, int>
     */
    private function fillDays(array $counts, int $days): array
    {
        $filled = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = LocalDay::key($i);
            $filled[$day] = (int) ($counts[$day] ?? 0);
        }

        return $filled;
    }
}
