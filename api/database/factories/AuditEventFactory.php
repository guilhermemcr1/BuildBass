<?php

namespace Database\Factories;

use App\Enums\AuditType;
use App\Models\AuditEvent;
use App\Support\IpHash;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AuditEvent>
 */
class AuditEventFactory extends Factory
{
    /**
     * Por padrão, uma edição de driver feita por um moderador.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => AuditType::DriverUpdated,
            'actor_id' => fake()->uuid(),
            'actor_name' => fake()->name(),
            'actor_email' => fake()->unique()->safeEmail(),
            'subject_type' => 'driver',
            'subject_id' => fake()->uuid(),
            'subject_label' => fake()->company().' '.fake()->bothify('??-###'),
            'changes' => ['qts' => [0.4, 0.45]],
            'created_at' => now(),
        ];
    }

    public function login(): static
    {
        return $this->state(fn () => [
            'type' => AuditType::Login,
            'outcome' => 'ok',
            'subject_type' => null,
            'subject_id' => null,
            'subject_label' => null,
            'changes' => null,
            'ip_hash' => IpHash::make(fake()->ipv4()),
        ]);
    }

    public function loginFailed(): static
    {
        return $this->login()->state(fn () => [
            'type' => AuditType::LoginFailed,
            'outcome' => 'failed',
            'actor_id' => null,
            'actor_name' => null,
        ]);
    }

    public function manualRead(bool $counted = true): static
    {
        return $this->state(fn () => [
            'type' => AuditType::ManualRead,
            'outcome' => 'ok',
            'actor_id' => null,
            'actor_name' => null,
            'actor_email' => null,
            'subject_type' => null,
            'subject_id' => null,
            'subject_label' => null,
            'changes' => null,
            'quota_counted' => $counted,
            'ip_hash' => IpHash::make(fake()->ipv4()),
        ]);
    }

    public function manualBlocked(string $reason = 'hourly'): static
    {
        return $this->manualRead(false)->state(fn () => [
            'type' => AuditType::ManualBlocked,
            'outcome' => 'blocked',
            'reason' => $reason,
            'quota_counted' => null,
        ]);
    }

    public function botBlocked(string $reason = 'honeypot'): static
    {
        return $this->manualRead(false)->state(fn () => [
            'type' => AuditType::BotBlocked,
            'outcome' => 'blocked',
            'reason' => $reason,
            'quota_counted' => null,
        ]);
    }
}
