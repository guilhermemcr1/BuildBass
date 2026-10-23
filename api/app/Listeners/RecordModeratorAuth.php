<?php

namespace App\Listeners;

use App\Enums\AuditType;
use App\Models\Moderator;
use App\Services\Audit\AuditLogger;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Registra no painel de moderação a entrada, a falha de login e a saída (feature 010, FR-011). Só o
 * guard `moderator`. Em `Failed` lê apenas o e-mail digitado: `credentials` traz a senha, que nunca
 * é lida aqui. Falhar ao gravar não pode atrapalhar o login.
 */
class RecordModeratorAuth
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(Login|Failed|Logout $event): void
    {
        if ($event->guard !== 'moderator') {
            return;
        }

        try {
            $this->record($event);
        } catch (Throwable $exception) {
            Log::warning('Falha ao gravar evento de acesso ao painel.', [
                'exception' => $exception::class,
            ]);
        }
    }

    private function record(Login|Failed|Logout $event): void
    {
        $ip = request()->ip();

        if ($event instanceof Failed) {
            $email = $event->credentials['email'] ?? null;

            $this->audit->record(AuditType::LoginFailed, [
                'outcome' => 'failed',
                'actor_email' => is_string($email) ? mb_substr($email, 0, 254) : null,
                'ip' => $ip,
            ]);

            return;
        }

        $actor = $event->user instanceof Moderator ? $event->user : null;

        $this->audit->record(
            $event instanceof Login ? AuditType::Login : AuditType::Logout,
            ['outcome' => 'ok', 'ip' => $ip],
            $actor,
        );
    }
}
