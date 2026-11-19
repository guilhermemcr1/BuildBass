<?php

namespace App\Services\BoxSuggestion;

use App\Exceptions\BoxSuggestionException;
use App\Support\LocalDay;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

// Cotas da sugestão por IA, no mesmo molde da leitura de manual (ExtractionQuota): limite por IP por
// hora e teto diário global. O IP é só chave de cache (expira em 1 h) e nunca vai a log.
class BoxSuggestionQuota
{
    private const HOUR_S = 3600;

    public function assertVisitorAllowed(string $ip): void
    {
        $key = $this->visitorKey($ip);

        if (RateLimiter::tooManyAttempts($key, (int) config('box_suggestion.hourly_limit'))) {
            throw BoxSuggestionException::rateLimited(RateLimiter::availableIn($key));
        }
    }

    public function hitVisitor(string $ip): void
    {
        RateLimiter::hit($this->visitorKey($ip), self::HOUR_S);
    }

    public function assertDailyAvailable(): void
    {
        if ((int) Cache::get($this->dayKey(), 0) >= (int) config('box_suggestion.daily_cap')) {
            throw BoxSuggestionException::unavailable();
        }
    }

    /** Só quando o provedor respondeu (inclusive resposta depois descartada por inválida). */
    public function countDaily(): void
    {
        $key = $this->dayKey();

        Cache::add($key, 0, LocalDay::end());
        Cache::increment($key);
    }

    private function visitorKey(string $ip): string
    {
        return "box-suggestion:{$ip}";
    }

    private function dayKey(): string
    {
        return 'box-suggestion:day:'.LocalDay::key();
    }
}
