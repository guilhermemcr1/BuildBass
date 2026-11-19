<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Falha esperada da sugestão de caixa por IA: vira resposta JSON `{message, code}`.
 * Motivos: `rate_limited` (429), `unavailable` (503) e `provider_failed` (502).
 */
class BoxSuggestionException extends RuntimeException
{
    /**
     * @param  non-empty-string  $reason  chave de `lang/*\/box_suggestion.php` e `code` do contrato
     * @param  bool  $responded  o provedor chegou a responder (conta no teto diário)
     */
    public function __construct(
        public readonly string $reason,
        public readonly int $status,
        public readonly int $retryAfterS = 0,
        public readonly bool $responded = false,
    ) {
        parent::__construct((string) __("box_suggestion.{$reason}"));
    }

    public static function rateLimited(int $retryAfterS): self
    {
        return new self('rate_limited', 429, $retryAfterS);
    }

    public static function unavailable(): self
    {
        return new self('unavailable', 503);
    }

    public static function providerFailed(bool $responded = false): self
    {
        return new self('provider_failed', 502, responded: $responded);
    }
}
