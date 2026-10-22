<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tipo do alto-falante (subwoofer, woofer…), opcional, para ajudar a escolher no catálogo. Os
// valores aceitos ficam em App\Models\Driver::TYPES; o banco guarda só o texto.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->string('type', 16)->nullable()->after('variant');
            $table->index('type');
            $table->index('nominal_diameter_m');
        });

        Schema::table('driver_submissions', function (Blueprint $table) {
            $table->string('type', 16)->nullable()->after('variant');
        });
    }

    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->dropIndex(['type']);
            $table->dropIndex(['nominal_diameter_m']);
            $table->dropColumn('type');
        });

        Schema::table('driver_submissions', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
