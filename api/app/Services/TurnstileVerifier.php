<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Throwable;

// Verificação anti-robô do Cloudflare Turnstile (modo invisível). Desligada fora de produção
// (services.turnstile.enabled). Ligada, qualquer falha reprova: falha fechada, para que derrubar a
// verificação não sirva de atalho. O IP do visitante não é repassado.
class TurnstileVerifier
{
    private const ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public function verify(?string $token): bool
    {
        if (config('services.turnstile.enabled') !== true) {
            return true;
        }

        if ($token === null || $token === '') {
            return false;
        }

        try {
            $response = Http::asForm()->timeout(5)->post(self::ENDPOINT, [
                'secret' => (string) config('services.turnstile.secret'),
                'response' => $token,
            ]);
        } catch (Throwable) {
            return false;
        }

        return $response->successful() && $response->json('success') === true;
    }
}
