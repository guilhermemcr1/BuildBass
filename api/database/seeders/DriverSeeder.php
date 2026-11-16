<?php

namespace Database\Seeders;

use App\Models\Driver;
use Illuminate\Database\Seeder;

// Drivers de exemplo, transcritos das fichas técnicas públicas do fabricante e convertidos para SI.
// Nada vem do banco ou dos arquivos do BassBox.
class DriverSeeder extends Seeder
{
    public function run(): void
    {
        $drivers = [
            [
                'brand' => 'Triton',
                'model' => 'TR 620 12"',
                'variant' => '4 Ω',
                'nominal_diameter_m' => 0.3048,
                'fs_hz' => 76.94,
                'qts' => 0.717,
                'qes' => 0.779,
                'qms' => 8.978,
                'vas_m3' => 0.026348,
                're_ohm' => 3.0,
                'le_h' => 0.000607,
                'xmax_m' => 0.00635,
                'sd_m2' => 0.05309,
                'pe_w' => 620.0,
                'bl_tm' => 10.9,
                'mms_kg' => 0.06392,
                'vd_m3' => 0.000333,
                'source' => 'Triton, ficha técnica TR 620 12", jul/2018 (AES 2-1984 rev. 2012)',
            ],
            [
                'brand' => 'Triton',
                'model' => 'TR 1250 12"',
                'variant' => '4 Ω',
                'nominal_diameter_m' => 0.3048,
                'fs_hz' => 64.46,
                'qts' => 0.42,
                'qes' => 0.44,
                'qms' => 9.88,
                'vas_m3' => 0.022,
                're_ohm' => 2.8,
                'le_h' => 0.00112,
                'xmax_m' => 0.01075,
                'sd_m2' => 0.04888,
                'pe_w' => 1250.0,
                'bl_tm' => 15.36,
                'mms_kg' => 0.09295,
                'vd_m3' => 0.000526,
                'source' => 'Triton, ficha técnica TR 1250 12", mar/2018',
            ],
        ];

        foreach ($drivers as $driver) {
            Driver::updateOrCreate(
                [
                    'brand' => $driver['brand'],
                    'model' => $driver['model'],
                    'variant' => $driver['variant'],
                ],
                $driver,
            );
        }
    }
}
