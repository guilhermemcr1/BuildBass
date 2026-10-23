<?php

namespace Database\Factories;

use App\Enums\DriverOrigin;
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

    /** Driver com formato, pistão e cotas A–G preenchidos (alto-falante redondo de 10"). */
    public function withDimensions(): static
    {
        return $this->state(fn () => [
            'drv_shape' => 'round',
            'drv_piston' => 'cone',
            'drv_a_m' => 0.27,
            'drv_b_m' => 0.22,
            'cutout_m' => 0.24,
            'drv_e_m' => 0.06,
            'drv_f_m' => 0.01,
            'drv_g_m' => 0.12,
        ]);
    }

    public function direct(): static
    {
        return $this->state(fn () => ['origin' => DriverOrigin::Direct]);
    }

    public function approved(): static
    {
        return $this->state(fn () => ['origin' => DriverOrigin::ApprovedSubmission]);
    }

    /**
     * Driver com imagens já registradas (caminhos no disco público; os arquivos não são criados).
     */
    public function withImages(int $count = 2): static
    {
        return $this->state(fn () => [
            'images' => array_map(
                fn (): string => 'driver-images/'.fake()->uuid().'.webp',
                range(1, $count),
            ),
        ]);
    }
}
