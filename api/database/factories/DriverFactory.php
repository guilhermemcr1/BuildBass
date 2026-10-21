<?php

namespace Database\Factories;

use App\Models\Driver;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Driver>
 */
class DriverFactory extends Factory
{
    /**
     * Valores plausíveis e dentro das faixas do app, só para os testes.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'brand' => fake()->unique()->company(),
            'model' => fake()->bothify('??-###'),
            'variant' => '',
            'nominal_diameter_m' => 0.254,
            'fs_hz' => 40.0,
            'qts' => 0.4,
            'vas_m3' => 0.08,
            'qes' => 0.45,
            'qms' => 4.5,
            're_ohm' => 3.2,
            'le_h' => 0.0015,
            'xmax_m' => 0.01,
            'sd_m2' => 0.03,
            'pe_w' => 300.0,
            'bl_tm' => 12.0,
            'mms_kg' => 0.08,
            'vd_m3' => 0.0003,
            'source' => 'Dados de teste',
        ];
    }
}
