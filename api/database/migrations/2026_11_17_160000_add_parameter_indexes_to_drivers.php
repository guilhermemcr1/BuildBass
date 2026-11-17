<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Índices para os filtros por faixa de Fs, Qts e Vas do buscador da bancada.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->index('fs_hz');
            $table->index('qts');
            $table->index('vas_m3');
        });
    }

    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->dropIndex(['fs_hz']);
            $table->dropIndex(['qts']);
            $table->dropIndex(['vas_m3']);
        });
    }
};
