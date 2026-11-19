<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Medidas físicas no envio (as mesmas de `drivers`): formato, pistão e cotas A–G em metros.
     * Opcionais; ao aprovar, seguem para o driver do catálogo.
     */
    public function up(): void
    {
        Schema::table('driver_submissions', function (Blueprint $table) {
            $table->string('drv_shape', 8)->nullable()->after('vd_m3');
            $table->string('drv_piston', 8)->nullable()->after('drv_shape');
            $table->double('drv_a_m')->nullable()->after('drv_piston');
            $table->double('drv_b_m')->nullable()->after('drv_a_m');
            $table->double('cutout_m')->nullable()->after('drv_b_m');
            $table->double('drv_d_m')->nullable()->after('cutout_m');
            $table->double('drv_e_m')->nullable()->after('drv_d_m');
            $table->double('drv_f_m')->nullable()->after('drv_e_m');
            $table->double('drv_g_m')->nullable()->after('drv_f_m');
        });
    }

    public function down(): void
    {
        Schema::table('driver_submissions', function (Blueprint $table) {
            $table->dropColumn([
                'drv_shape', 'drv_piston', 'drv_a_m', 'drv_b_m', 'cutout_m',
                'drv_d_m', 'drv_e_m', 'drv_f_m', 'drv_g_m',
            ]);
        });
    }
};
