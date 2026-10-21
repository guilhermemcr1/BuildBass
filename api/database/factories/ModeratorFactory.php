<?php

namespace Database\Factories;

use App\Models\Moderator;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Moderator>
 */
class ModeratorFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => 'senha-de-teste-123',
        ];
    }
}
