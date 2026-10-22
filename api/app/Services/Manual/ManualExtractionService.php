<?php

namespace App\Services\Manual;

use App\Exceptions\Manual\ManualException;
use App\Exceptions\Manual\ManualProviderException;
use App\Exceptions\Manual\ManualUnavailableException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

// Leitura de manual (feature 009): PDF → texto → IA → sugestão. Sem estado e sem gravar nada: o
// arquivo é o temporário do upload e o log leva só desfecho, duração e modelo (FR-010, FR-013).
// Ordem (research.md §5): páginas (sem cota) → recurso ligado → limite por hora → teto diário →
// conta a tentativa → texto → IA → conta o teto diário se o provedor respondeu.
class ManualExtractionService
{
    public function __construct(
        private readonly PdfTextExtractor $pdf,
        private readonly ManualAiClient $ai,
        private readonly ManualSuggestionBuilder $builder,
        private readonly ExtractionQuota $quota,
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

        try {
            $this->assertEnabled();

            $path = (string) $file->getRealPath();
            $this->pdf->assertWithinPageLimit($path);

            $this->quota->assertVisitorAllowed($ip);
            $this->quota->assertDailyAvailable();
            $this->quota->hitVisitor($ip);

            $text = $this->pdf->extract($path);

            try {
                $drivers = $this->ai->read($text);
            } catch (ManualProviderException $exception) {
                if ($exception->responded) {
                    $this->quota->countDaily();
                }

                throw $exception;
            }

            $this->quota->countDaily();

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
        }
    }

    private function assertEnabled(): void
    {
        $configured = config('manual_extraction.enabled') === true
            && (string) config('services.openrouter.key') !== ''
            && (string) config('services.openrouter.model') !== '';

        if (! $configured) {
            throw new ManualUnavailableException;
        }
    }
}
