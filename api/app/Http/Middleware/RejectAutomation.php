<?php

namespace App\Http\Middleware;

use App\Enums\AuditType;
use App\Services\Audit\AuditLogger;
use App\Services\TurnstileVerifier;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

// Barra automação nos envios públicos (FR-011) antes de qualquer validação ou gravação:
// 1. campo-armadilha preenchido → resposta idêntica a um sucesso, mas nada é gravado;
// 2. verificação anti-robô reprovada → 422 genérico, sem revelar o motivo.
class RejectAutomation
{
    public function __construct(
        private readonly TurnstileVerifier $turnstile,
        private readonly AuditLogger $audit,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $trap = $request->input('website');

        if ($trap !== null && $trap !== '') {
            $this->audit->recordDeferred(AuditType::BotBlocked, ['outcome' => 'blocked', 'reason' => 'honeypot'], $request->ip());

            return response()->json(
                ['data' => ['protocol' => (string) Str::uuid(), 'status' => 'pending']],
                201,
            );
        }

        $token = $request->input('turnstile_token');

        if (! $this->turnstile->verify(is_string($token) ? $token : null)) {
            $this->audit->recordDeferred(AuditType::BotBlocked, ['outcome' => 'blocked', 'reason' => 'verification'], $request->ip());

            return $this->verificationFailed();
        }

        return $next($request);
    }

    private function verificationFailed(): JsonResponse
    {
        return response()->json([
            'message' => (string) __('submission.verification_failed'),
            'code' => 'verification_failed',
        ], 422);
    }
}
