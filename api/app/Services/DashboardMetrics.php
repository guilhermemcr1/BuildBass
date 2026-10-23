<?php

namespace App\Services;

use App\Enums\AuditType;
use App\Enums\SubmissionStatus;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Services\Manual\ManualExtractionService;
use DateTimeInterface;
use Illuminate\Support\Collection;
use stdClass;

/**
 * Números do painel inicial da moderação (feature 010). Só consultas agregadas, sem cache: cada
 * abertura do painel lê o estado de agora. Dias são UTC (fuso do app), como a cota diária da IA.
 */
class DashboardMetrics
{
    public const WINDOW_DAYS = 30;

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
            ->selectRaw('DATE(created_at) as day, COUNT(*) as total')
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
     * `manual_read` que contaram para o teto (`quota_counted`) no dia UTC corrente.
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
        $today = now()->format('Y-m-d');
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
            ->where('created_at', '>=', now()->startOfDay())
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

    /** @return Collection<int, stdClass> */
    private function manualRows(int $days): Collection
    {
        return AuditEvent::query()
            ->whereIn('type', [AuditType::ManualRead->value, AuditType::ManualBlocked->value])
            ->where('created_at', '>=', $this->windowStart($days))
            ->selectRaw('DATE(created_at) as day, type, outcome, COUNT(*) as total')
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
        return now()->subDays($days - 1)->startOfDay();
    }

    /**
     * @param  array<string, int|string>  $counts
     * @return array<string, int>
     */
    private function fillDays(array $counts, int $days): array
    {
        $filled = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $day = now()->subDays($i)->format('Y-m-d');
            $filled[$day] = (int) ($counts[$day] ?? 0);
        }

        return $filled;
    }
}
