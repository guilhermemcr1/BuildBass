<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Trilha de auditoria do painel. Imutável: uma linha por evento. O autor e o
     * objeto não têm chave estrangeira de propósito: nome, e-mail e rótulo são copiados no
     * instante, então apagar o moderador ou o driver não apaga nem anonimiza a trilha. O IP só
     * existe em hash.
     */
    public function up(): void
    {
        Schema::create('audit_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type', 32);
            $table->string('outcome', 16)->nullable();
            $table->string('reason', 64)->nullable();

            $table->uuid('actor_id')->nullable();
            $table->string('actor_name', 120)->nullable();
            $table->string('actor_email', 254)->nullable();

            $table->string('subject_type', 24)->nullable();
            $table->uuid('subject_id')->nullable();
            $table->string('subject_label', 200)->nullable();

            $table->char('ip_hash', 64)->nullable();
            $table->json('changes')->nullable();
            $table->json('snapshot')->nullable();
            // Só em `manual_read`: a tentativa contou para o teto diário da IA.
            $table->boolean('quota_counted')->nullable();

            $table->timestamp('created_at')->useCurrent();

            $table->index(['type', 'created_at']);
            $table->index(['actor_id', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
    }
};
