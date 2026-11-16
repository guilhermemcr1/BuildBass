<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fila de envios de drivers. O id é o código de protocolo. Valores em SI, com os
     * mesmos nomes de `drivers`. O IP nunca é guardado em claro (só `ip_hash`) e `contact_email` é
     * apagado depois do aviso da decisão.
     */
    public function up(): void
    {
        Schema::create('driver_submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('status', 16)->default('pending');

            $table->string('brand', 80);
            $table->string('model', 80);
            $table->string('variant', 40)->default('');
            $table->float('nominal_diameter_m')->nullable();

            $table->float('fs_hz');
            $table->float('qts');
            $table->float('vas_m3');
            $table->float('qes')->nullable();
            $table->float('qms')->nullable();
            $table->float('re_ohm')->nullable();
            $table->float('le_h')->nullable();
            $table->float('xmax_m')->nullable();
            $table->float('sd_m2')->nullable();
            $table->float('pe_w')->nullable();
            $table->float('bl_tm')->nullable();
            $table->float('mms_kg')->nullable();
            $table->float('vd_m3')->nullable();

            $table->string('source', 255);
            $table->string('dedupe_key', 200);
            $table->char('ip_hash', 64);
            $table->string('contact_email', 254)->nullable();
            $table->string('locale', 5);

            $table->string('rejection_reason', 500)->nullable();
            $table->foreignUuid('decided_by')->nullable()->constrained('moderators')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->foreignUuid('driver_id')->nullable()->constrained('drivers')->nullOnDelete();

            $table->timestamps();

            $table->index('status');
            $table->index(['status', 'created_at']);
            $table->index('dedupe_key');
            $table->index('ip_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_submissions');
    }
};
