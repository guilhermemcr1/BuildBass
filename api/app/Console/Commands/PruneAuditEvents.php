<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Apaga os eventos de auditoria mais antigos que o prazo de retenção (feature 010, FR-018). Apaga
 * por consulta direta, fora do model: o `AuditEvent` é imutável e não aceita `delete()`.
 */
class PruneAuditEvents extends Command
{
    protected $signature = 'audit:prune';

    protected $description = 'Apaga os eventos de auditoria mais antigos que o prazo de retenção';

    public function handle(): int
    {
        $limit = now()->subDays((int) config('audit.retention_days'));
        $total = 0;

        do {
            $ids = DB::table('audit_events')->where('created_at', '<', $limit)->limit(1000)->pluck('id');
            $deleted = $ids->isEmpty() ? 0 : DB::table('audit_events')->whereIn('id', $ids)->delete();
            $total += $deleted;
        } while ($deleted > 0);

        $this->info("{$total} evento(s) de auditoria apagado(s).");

        return self::SUCCESS;
    }
}
