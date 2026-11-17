<?php

namespace App\Http\Middleware;

use App\Services\Security\SubmissionAttempts;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Primeira barreira dos envios públicos: um IP bloqueado por tentativas suspeitas recebe 429 com
// Retry-After antes de tocar no limite por hora, no anti-robô ou no banco.
class BlockAbusiveSenders
{
    public function __construct(private readonly SubmissionAttempts $attempts) {}

    public function handle(Request $request, Closure $next): Response
    {
        $seconds = $this->attempts->blockedFor($request->ip());

        if ($seconds > 0) {
            return response()->json([
                'message' => (string) __('submission.blocked'),
                'code' => 'too_many_attempts',
            ], 429, ['Retry-After' => (string) $seconds]);
        }

        return $next($request);
    }
}
