<?php

namespace App\Services\Security;

use App\Enums\AuditType;
use App\Services\Audit\AuditLogger;
use App\Support\IpHash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Tentativas de envio público (driver e leitura de manual) que não passaram. Cada recusa vai para a
 * trilha; as suspeitas (anti-robô, validação, limite) também contam falta para o IP. Com
 * `abuse.max_strikes` faltas na janela, o IP fica bloqueado por `abuse.block_minutes` e o
 * bloqueio entra na trilha uma vez só, no início: um robô insistindo não multiplica linhas.
 */
class SubmissionAttempts
{
    public const REASON_THROTTLED = 'throttled';

    public const REASON_INVALID = 'invalid';

    public const REASON_DUPLICATE = 'duplicate';

    public const REASON_ABUSE = 'abuse';

    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array<string, mixed>  $snapshot  só metadados (nomes de campo), nunca o que foi digitado
     */
    public function refused(string $reason, ?string $ip, array $snapshot = []): void
    {
        $this->audit->recordDeferred(AuditType::SubmissionRefused, [
            'outcome' => $reason === self::REASON_THROTTLED ? 'blocked' : 'failed',
            'reason' => $reason,
            'snapshot' => $snapshot === [] ? null : $snapshot,
        ], $ip);

        // Driver repetido é engano comum de gente de verdade, não sinal de robô.
        if ($reason !== self::REASON_DUPLICATE) {
            $this->strike($ip);
        }
    }

    public function strike(?string $ip): void
    {
        if ($ip === null || $ip === '') {
            return;
        }

        $key = $this->key('strikes', $ip);
        $strikes = RateLimiter::hit($key, (int) config('abuse.window_minutes') * 60);

        if ($strikes < (int) config('abuse.max_strikes')) {
            return;
        }

        RateLimiter::clear($key);
        $minutes = (int) config('abuse.block_minutes');
        $until = now()->addMinutes($minutes);
        Cache::put($this->key('block', $ip), $until->getTimestamp(), $until);

        $this->audit->recordDeferred(AuditType::SubmissionRefused, [
            'outcome' => 'blocked',
            'reason' => self::REASON_ABUSE,
            'snapshot' => ['faltas' => $strikes, 'bloqueio_minutos' => $minutes],
        ], $ip);
    }

    /** Segundos até o IP poder enviar de novo; 0 quando não está bloqueado. */
    public function blockedFor(?string $ip): int
    {
        if ($ip === null || $ip === '') {
            return 0;
        }

        $until = Cache::get($this->key('block', $ip));

        return is_int($until) ? max(0, $until - now()->getTimestamp()) : 0;
    }

    private function key(string $kind, string $ip): string
    {
        return "submission-{$kind}:".IpHash::make($ip);
    }
}
