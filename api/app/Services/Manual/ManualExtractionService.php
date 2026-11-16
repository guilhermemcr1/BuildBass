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
        $started = microtime(true);
        $outcome = 'ok';
        // Em qual cota a tentativa está sendo checada; vira o motivo do bloqueio se ela barrar.
        $gate = null;
        $counted = false;

        try {
            $gate = 'unavailable';
            $this->assertEnabled();

            $path = (string) $file->getRealPath();
            $this->pdf->assertWithinPageLimit($path);

            $gate = 'hourly';
            $this->quota->assertVisitorAllowed($ip);
            $gate = 'daily';
            $this->quota->assertDailyAvailable();
            $gate = null;
            $this->quota->hitVisitor($ip);

            $text = $this->pdf->extract($path);

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
