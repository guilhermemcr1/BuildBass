<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Throwable;

// Verificação anti-robô do Cloudflare Turnstile (modo invisível). Desligada fora de produção
// (services.turnstile.enabled). Ligada, qualquer falha reprova: falha fechada, para que derrubar a
// verificação não sirva de atalho. O IP do visitante não é repassado.
class TurnstileVerifier
{
    public const PASSED = 'passed';

    public const FAILED = 'failed';

    // A Cloudflare não respondeu (DNS, conexão, 5xx): reprova igual, mas a trilha separa do robô.
    public const UNREACHABLE = 'unreachable';

    private const ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public function verify(?string $token): bool
    {
        return $this->check($token) === self::PASSED;
    }

    /** @return self::PASSED|self::FAILED|self::UNREACHABLE */
    public function check(?string $token): string
    {
        if (config('services.turnstile.enabled') !== true) {
            return self::PASSED;
        }

        if ($token === null || $token === '') {
            return self::FAILED;
        }

        try {
            // Uma nova tentativa só em falha de conexão (DNS instável, por exemplo): o token do
            // Turnstile é de uso único, e repetir depois de uma resposta o daria por gasto.
            $response = Http::asForm()
                ->timeout(5)
                ->retry(2, 300, fn (Throwable $exception): bool => $exception instanceof ConnectionException, throw: false)
                ->post(self::ENDPOINT, [
                    'secret' => (string) config('services.turnstile.secret'),
                    'response' => $token,
                ]);
        } catch (Throwable) {
            return self::UNREACHABLE;
        }

        if ($response->serverError()) {
            return self::UNREACHABLE;
        }

        return $response->successful() && $response->json('success') === true ? self::PASSED : self::FAILED;
    }
}
