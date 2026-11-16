<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Moderadores do painel. Contas criadas pelo mantenedor com `moderator:create`;
     * não há cadastro público nem login de usuário final.
     */
    public function up(): void
    {
        Schema::create('moderators', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 100);
            $table->string('email', 254)->unique();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moderators');
    }
};
