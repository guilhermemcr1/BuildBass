<?php

namespace App\Services\Manual;

use App\Enums\AuditType;
use App\Exceptions\Manual\ManualException;
use App\Exceptions\Manual\ManualProviderException;
use App\Exceptions\Manual\ManualUnavailableException;
use App\Services\Audit\AuditLogger;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

// Leitura de manual: PDF → texto → IA → sugestão. Sem estado e sem gravar nada: o
// arquivo é o temporário do upload e o log leva só desfecho, duração e modelo.
// Ordem: páginas (sem cota) → recurso ligado → limite por hora → teto diário →
// conta a tentativa → texto → IA → conta o teto diário se o provedor respondeu.
// Feature 010: cada tentativa também vira um evento de auditoria (manual_read ou manual_blocked),
// gravado depois da resposta, sem PDF, texto nem IP em claro.
class ManualExtractionService
{
    public function __construct(
        private readonly PdfTextExtractor $pdf,
        private readonly ManualAiClient $ai,
        private readonly ManualSuggestionBuilder $builder,
        private readonly ManualTextFilter $filter,
        private readonly ExtractionQuota $quota,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @return array{suggestion: array<string, string|float|null>, suspect: list<string>, discarded: list<string>, warnings: list<string>}
     *
     * @throws ManualException
     */
    public function extract(UploadedFile $file, string $ip): array
    {
        $path = (string) $file->getRealPath();

        // Páginas antes de contar a tentativa; o texto sai do PDF depois dela.
        return $this->run($ip, function () use ($path): callable {
            $this->pdf->assertWithinPageLimit($path);

            return fn (): string => $this->pdf->extract($path);
        });
    }

    /**
     * Texto colado pelo visitante: o filtro corta tudo o que não é linha de parâmetro antes de
     * contar a tentativa, então um texto sem parâmetro algum não gasta cota nem chama a IA.
     *
     * @return array{suggestion: array<string, string|float|null>, suspect: list<string>, discarded: list<string>, warnings: list<string>}
     *
     * @throws ManualException
     */
    public function extractText(string $raw, string $ip): array
    {
        return $this->run($ip, function () use ($raw): callable {
            $text = $this->filter->filter($raw);

            return fn (): string => $text;
        });
    }

    /**
     * @param  callable(): (callable(): string)  $prepare  checagem sem cota; devolve quem lê o texto
     * @return array{suggestion: array<string, string|float|null>, suspect: list<string>, discarded: list<string>, warnings: list<string>}
     *
     * @throws ManualException
     */
    private function run(string $ip, callable $prepare): array
    {
        $started = microtime(true);
        $outcome = 'ok';
        // Em qual cota a tentativa está sendo checada; vira o motivo do bloqueio se ela barrar.
        $gate = null;
        $counted = false;

        try {
            $gate = 'unavailable';
            $this->assertEnabled();

            // Cotas antes de abrir o PDF ou filtrar o texto: quem já estourou o limite não gasta servidor.
            $gate = 'hourly';
            $this->quota->assertVisitorAllowed($ip);
            $gate = 'daily';
            $this->quota->assertDailyAvailable();
            $gate = null;

            $read = $prepare();
            $this->quota->hitVisitor($ip);

            $text = $read();

            try {
                $drivers = $this->ai->read($text);
            } catch (ManualProviderException $exception) {
                if ($exception->responded) {
                    $this->quota->countDaily();
                    $counted = true;
                }

                throw $exception;
            }

            $this->quota->countDaily();
            $counted = true;

            return $this->builder->build($drivers);
        } catch (ManualException $exception) {
            $outcome = $exception->reason;

            throw $exception;
        } finally {
            Log::info('manual_extraction', [
                'outcome' => $outcome,
                'duration_ms' => (int) round((microtime(true) - $started) * 1000),
                'model' => (string) config('services.openrouter.model'),
            ]);

            $this->audit($outcome, $gate, $counted, $ip);
        }
    }

    /** A leitura por IA está ligada e configurada (chave e modelo). */
    public function enabled(): bool
    {
        return config('manual_extraction.enabled') === true
            && (string) config('services.openrouter.key') !== ''
            && (string) config('services.openrouter.model') !== '';
    }

    private function audit(string $outcome, ?string $gate, bool $counted, string $ip): void
    {
        $blocked = $gate !== null && in_array($outcome, ['rate_limited', 'unavailable'], true);

        if ($blocked) {
            $this->audit->recordDeferred(AuditType::ManualBlocked, ['outcome' => 'blocked', 'reason' => $gate], $ip);

            return;
        }

        $this->audit->recordDeferred(AuditType::ManualRead, [
            'outcome' => $outcome === 'ok' ? 'ok' : 'failed',
            'reason' => $outcome === 'ok' ? null : $outcome,
            'quota_counted' => $counted,
        ], $ip);
    }

    private function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw new ManualUnavailableException;
        }
    }
}
