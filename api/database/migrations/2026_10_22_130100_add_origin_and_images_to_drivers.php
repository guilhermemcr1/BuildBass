<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `origin` diz como o driver entrou no catálogo; `images` é a galeria (lista de
     * caminhos no disco público, o primeiro é a capa). Os drivers que já existem e vieram de um
     * envio aprovado são marcados como tal; o resto fica como carga inicial.
     */
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->string('origin', 24)->default('initial_load')->after('source');
            $table->json('images')->nullable()->after('origin');
        });

        DB::statement(
            "UPDATE drivers SET origin = 'approved_submission' "
            .'WHERE id IN (SELECT driver_id FROM driver_submissions WHERE driver_id IS NOT NULL)',
        );
    }

    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->dropColumn(['origin', 'images']);
        });
    }
};
