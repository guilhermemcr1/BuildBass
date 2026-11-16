<?php

namespace Database\Seeders;

use App\Models\DriverSubmission;
use App\Support\IpHash;
use Illuminate\Database\Seeder;

// Envios fictícios para o moderador experimentar o painel. Só desenvolvimento: fora
// do DatabaseSeeder e sem dados reais. Marcas e valores inventados.
class DriverSubmissionSeeder extends Seeder
{
    public function run(): void
    {
        $shared = IpHash::make('198.51.100.20');

        // Pendente simples.
        DriverSubmission::factory()->create([
            'brand' => 'Exemplo Áudio',
            'model' => 'EX-12',
            'variant' => '4 Ω',
            'nominal_diameter_m' => 0.3048,
            'fs_hz' => 34.5,
            'qts' => 0.41,
            'vas_m3' => 0.085,
            'source' => 'Dados fictícios de demonstração',
            'ip_hash' => IpHash::make('198.51.100.10'),
            'created_at' => now()->subDays(2),
        ]);

        // Provável duplicata do catálogo (mesma chave do Triton do DriverSeeder).
        DriverSubmission::factory()->create([
            'brand' => 'TRITON',
            'model' => 'tr 620 12"',
            'variant' => '4 Ω',
            'source' => 'Dados fictícios de demonstração',
            'ip_hash' => $shared,
            'created_at' => now()->subDay(),
        ]);

        // Segundo envio do mesmo remetente.
        DriverSubmission::factory()->create([
            'brand' => 'Exemplo Áudio',
            'model' => 'EX-15',
            'fs_hz' => 28.0,
            'qts' => 0.38,
            'vas_m3' => 0.19,
            'source' => 'Dados fictícios de demonstração',
            'ip_hash' => $shared,
            'created_at' => now()->subHours(3),
        ]);
    }
}
