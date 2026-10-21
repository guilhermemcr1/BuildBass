<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Catálogo de drivers (specs/003-catalogo-de-drivers/data-model.md). Tudo em SI, com os mesmos
// nomes de campo do projeto do front. Fs, Qts e Vas são obrigatórios; o resto pode faltar.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drivers', function (Blueprint $table) {
            $table->id();
            $table->string('brand', 80);
            $table->string('model', 80);
            $table->string('variant', 40)->default('');
            $table->double('nominal_diameter_m')->nullable();

            $table->double('fs_hz');
            $table->double('qts');
            $table->double('vas_m3');

            $table->double('qes')->nullable();
            $table->double('qms')->nullable();
            $table->double('re_ohm')->nullable();
            $table->double('le_h')->nullable();
            $table->double('xmax_m')->nullable();
            $table->double('sd_m2')->nullable();
            $table->double('pe_w')->nullable();
            $table->double('bl_tm')->nullable();
            $table->double('mms_kg')->nullable();
            $table->double('vd_m3')->nullable();

            $table->string('source', 255);
            // "marca modelo variação" em minúsculas e sem acento; gerado pelo model.
            $table->string('search_text', 200);
            $table->timestamps();

            // Também serve à ordenação por marca e modelo.
            $table->unique(['brand', 'model', 'variant']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drivers');
    }
};
