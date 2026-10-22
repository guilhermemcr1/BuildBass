<?php

namespace App\Services\Manual;

use App\Exceptions\Manual\ManualRateLimitedException;
use App\Exceptions\Manual\ManualUnavailableException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

// Cotas da leitura de manual (feature 009, research.md §5). O `throttle` do Laravel conta toda
// requisição que chega; aqui só conta o que a spec manda (FR-017 a FR-020). O IP é só chave de
// cache (expira em 1 h) e nunca vai a log. O teto diário é um soft cap: requisições concorrentes
// podem passar dele por uma ou duas, o que basta para proteger o custo.
class ExtractionQuota
{
    private const HOUR_S = 3600;

    public function assertVisitorAllowed(string $ip): void
    {
        $key = $this->visitorKey($ip);

        if (RateLimiter::tooManyAttempts($key, (int) config('manual_extraction.hourly_limit'))) {
            throw new ManualRateLimitedException(RateLimiter::availableIn($key));
        }
    }

    /** A tentativa passou a contar no limite por hora, mesmo que o PDF depois seja ilegível. */
    public function hitVisitor(string $ip): void
    {
        RateLimiter::hit($this->visitorKey($ip), self::HOUR_S);
    }

    public function assertDailyAvailable(): void
    {
        if ((int) Cache::get($this->dayKey(), 0) >= (int) config('manual_extraction.daily_cap')) {
            throw new ManualUnavailableException;
        }
    }

    /** Só quando o provedor de IA respondeu (inclusive resposta depois descartada por inválida). */
    public function countDaily(): void
    {
        $key = $this->dayKey();

        Cache::add($key, 0, now()->endOfDay());
        Cache::increment($key);
    }

    private function visitorKey(string $ip): string
    {
        return "manual-extraction:{$ip}";
    }

    private function dayKey(): string
    {
        return 'manual-extraction:day:'.now()->format('Y-m-d');
    }
}
