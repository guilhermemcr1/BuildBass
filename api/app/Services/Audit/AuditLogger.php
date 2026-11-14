<?php

namespace App\Services\Audit;

use App\Enums\AuditType;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\Moderator;
use App\Support\IpHash;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Grava a trilha de auditoria (feature 010, contracts/audit-events.md). Duas portas:
 * - `record()`: síncrono, para as ações de moderador; roda dentro da transação da ação e **propaga**
 *   o erro, para nunca existir mudança sem evento;
 * - `recordDeferred()`: para a API pública; roda depois da resposta e engole qualquer falha, para o
 *   visitante nunca perceber.
 * O IP entra por `ip` e só sai como hash; nada mais pessoal é aceito.
 */
class AuditLogger
{
    /**
     * @param  array{outcome?: ?string, reason?: ?string, actor_email?: ?string, subject_type?: ?string, subject_id?: ?string, subject_label?: ?string, ip?: ?string, changes?: ?array<string, mixed>, snapshot?: ?array<string, mixed>, quota_counted?: ?bool}  $attributes
     */
    public function record(AuditType $type, array $attributes = [], ?Moderator $actor = null): AuditEvent
    {
        $ip = Arr::pull($attributes, 'ip');

        if ($actor !== null) {
            $attributes['actor_id'] = $actor->getKey();
            $attributes['actor_name'] = $actor->name;
            $attributes['actor_email'] = $actor->email;
        }

        return AuditEvent::create([
            ...$attributes,
            'type' => $type,
            'ip_hash' => is_string($ip) && $ip !== '' ? IpHash::make($ip) : null,
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array{outcome?: ?string, reason?: ?string, subject_type?: ?string, subject_id?: ?string, subject_label?: ?string, quota_counted?: ?bool}  $attributes
     */
    public function recordDeferred(AuditType $type, array $attributes = [], ?string $ip = null): void
    {
        $attributes['ip'] = $ip;

        defer(function () use ($type, $attributes): void {
            try {
                $this->record($type, $attributes);
            } catch (Throwable $exception) {
                // Sem dados do evento no log: nada de IP, e-mail ou texto.
                Log::warning('Falha ao gravar evento de auditoria.', [
                    'type' => $type->value,
                    'exception' => $exception::class,
                ]);
            }
            // Sem `always()` o Laravel descarta o callback em resposta 4xx/5xx, e bloqueios e
            // falhas de leitura (429, 422, 502, 503) nunca chegariam à trilha.
        })->always();
    }

    /** "Fabricante Modelo (Variante)", como a lista do painel mostra o driver. */
    public function driverLabel(Driver $driver): string
    {
        $name = "{$driver->brand} {$driver->model}";

        return $driver->variant === '' ? $name : "{$name} ({$driver->variant})";
    }
}
