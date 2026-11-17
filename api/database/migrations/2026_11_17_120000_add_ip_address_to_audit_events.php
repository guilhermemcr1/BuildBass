<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * IP em claro ao lado do hash: a moderação precisa ver de onde veio um ataque. Some com o evento
     * na retenção (`audit:prune`, AUDIT_RETENTION_DAYS). 45 caracteres cabem um IPv6 completo.
     */
    public function up(): void
    {
        Schema::table('audit_events', function (Blueprint $table) {
            $table->string('ip_address', 45)->nullable()->after('ip_hash');
            $table->index(['ip_address', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('audit_events', function (Blueprint $table) {
            $table->dropIndex(['ip_address', 'created_at']);
            $table->dropColumn('ip_address');
        });
    }
};
