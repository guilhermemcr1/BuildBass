<?php

namespace Database\Factories;

use App\Enums\SubmissionStatus;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DriverSubmission>
 */
class DriverSubmissionFactory extends Factory
{
    /**
     * Valores plausíveis e dentro das faixas do app, só para os testes.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'status' => SubmissionStatus::Pending,
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
            'ip_hash' => hash('sha256', fake()->unique()->ipv4()),
            'contact_email' => null,
            'locale' => 'pt-BR',
        ];
    }

    public function approved(): static
    {
        return $this->state(fn () => [
            'status' => SubmissionStatus::Approved,
            'decided_by' => Moderator::factory(),
            'decided_at' => now(),
            'driver_id' => Driver::factory(),
        ]);
    }

    public function rejected(): static
    {
        return $this->state(fn () => [
            'status' => SubmissionStatus::Rejected,
            'decided_by' => Moderator::factory(),
            'decided_at' => now(),
            'rejection_reason' => 'Dados não conferem com a ficha.',
        ]);
    }
}
