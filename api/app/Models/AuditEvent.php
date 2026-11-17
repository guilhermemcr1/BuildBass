<?php

namespace App\Models;

use App\Enums\AuditType;
use Database\Factories\AuditEventFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use LogicException;

/**
 * Evento da trilha de auditoria. Imutável: só se cria; a retenção apaga por consulta
 * direta (`audit:prune`), fora do model. Autor e objeto são copiados no instante, sem chave
 * estrangeira. Rede: `ip_address` (em claro, para a moderação) e `ip_hash` (para agrupar).
 *
 * @property string $id
 * @property AuditType $type
 * @property string|null $outcome
 * @property string|null $reason
 * @property string|null $actor_id
 * @property string|null $actor_name
 * @property string|null $actor_email
 * @property string|null $subject_type
 * @property string|null $subject_id
 * @property string|null $subject_label
 * @property string|null $ip_hash
 * @property string|null $ip_address
 * @property array<string, mixed>|null $changes
 * @property array<string, mixed>|null $snapshot
 * @property bool|null $quota_counted
 * @property Carbon $created_at
 */
class AuditEvent extends Model
{
    /** @use HasFactory<AuditEventFactory> */
    use HasFactory;

    use HasUuids;

    public const UPDATED_AT = null;

    protected $fillable = [
        'type',
        'outcome',
        'reason',
        'actor_id',
        'actor_name',
        'actor_email',
        'subject_type',
        'subject_id',
        'subject_label',
        'ip_hash',
        'ip_address',
        'changes',
        'snapshot',
        'quota_counted',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => AuditType::class,
            'changes' => 'array',
            'snapshot' => 'array',
            'quota_counted' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    public function outcomeLabel(): ?string
    {
        return self::translated('outcomes', $this->outcome);
    }

    /** Motivo traduzido; um motivo sem tradução (ex.: código de erro do provedor) aparece cru. */
    public function reasonLabel(): ?string
    {
        return self::translated('reasons', $this->reason);
    }

    /** Cor do resultado nos badges do painel. */
    public function outcomeColor(): string
    {
        return match ($this->outcome) {
            'ok' => 'success',
            'failed' => 'danger',
            'blocked' => 'warning',
            default => 'gray',
        };
    }

    private static function translated(string $group, ?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        $key = "audit.{$group}.{$value}";
        $label = (string) __($key);

        return $label === $key ? $value : $label;
    }

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new LogicException('Eventos de auditoria são imutáveis.');
        });

        static::deleting(function (): never {
            throw new LogicException('Eventos de auditoria são imutáveis.');
        });
    }
}
