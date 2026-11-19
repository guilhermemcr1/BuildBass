<?php

namespace App\Services\BoxSuggestion;

use App\Exceptions\BoxSuggestionException;
use Illuminate\Support\Facades\Log;

// Sugestão de caixa por IA. Ordem: recurso ligado → limite por hora → teto diário → conta a tentativa
// → IA → conta o teto diário se o provedor respondeu. O log leva só desfecho, duração e modelo.
class BoxSuggestionService
{
    public function __construct(
        private readonly BoxSuggestionAiClient $ai,
        private readonly BoxSuggestionQuota $quota,
    ) {}

    /**
     * @param  array<string, mixed>  $request  StoreBoxSuggestionRequest::forAi()
     * @return list<array<string, mixed>>
     *
     * @throws BoxSuggestionException
     */
    public function suggest(array $request, string $ip): array
    {
        $started = microtime(true);
        $outcome = 'ok';

        try {
            if (! self::enabled()) {
                throw BoxSuggestionException::unavailable();
            }

            $this->quota->assertVisitorAllowed($ip);
            $this->quota->assertDailyAvailable();
            $this->quota->hitVisitor($ip);

            try {
                $candidates = $this->ai->suggest($request);
            } catch (BoxSuggestionException $exception) {
                if ($exception->responded) {
                    $this->quota->countDaily();
                }

                throw $exception;
            }

            $this->quota->countDaily();

            return $candidates;
        } catch (BoxSuggestionException $exception) {
            $outcome = $exception->reason;

            throw $exception;
        } finally {
            Log::info('box_suggestion', [
                'outcome' => $outcome,
                'duration_ms' => (int) round((microtime(true) - $started) * 1000),
                'model' => BoxSuggestionAiClient::model(),
            ]);
        }
    }

    /** Ligada e configurada (chave e modelo). */
    public static function enabled(): bool
    {
        return config('box_suggestion.enabled') === true
            && (string) config('services.openrouter.key') !== ''
            && BoxSuggestionAiClient::model() !== '';
    }
}
