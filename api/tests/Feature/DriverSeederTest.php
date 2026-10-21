<?php

use App\Models\Driver;
use Database\Seeders\DriverSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// Faixas físicas do front (web/src/lib/parameters.ts); o seeder precisa caber nelas (FR-009).
const RANGES = [
    'fs_hz' => [1, 20000],
    'qts' => [0.05, 10],
    'qes' => [0.05, 10],
    'qms' => [0.1, 100],
    'vas_m3' => [1e-6, 10],
    're_ohm' => [0.1, 100],
    'le_h' => [0, 0.1],
    'xmax_m' => [0, 0.1],
    'sd_m2' => [1e-4, 2],
    'pe_w' => [0.1, 50000],
    'bl_tm' => [0.1, 100],
    'mms_kg' => [1e-4, 5],
    'vd_m3' => [0, 0.1],
    'nominal_diameter_m' => [0.03, 1.5],
];

beforeEach(function () {
    $this->seed(DriverSeeder::class);
});

it('cadastra os dois drivers Triton das fichas técnicas', function () {
    expect(Driver::count())->toBe(2);

    foreach (['TR 620 12"', 'TR 1250 12"'] as $model) {
        $driver = Driver::where('model', $model)->firstOrFail();

        expect($driver->brand)->toBe('Triton')
            ->and($driver->variant)->toBe('4 Ω')
            ->and($driver->source)->toContain('ficha técnica');
    }
});

it('é idempotente: rodar de novo não duplica', function () {
    $this->seed(DriverSeeder::class);

    expect(Driver::count())->toBe(2);
});

it('guarda os valores da ficha em SI', function () {
    $tr620 = Driver::where('model', 'TR 620 12"')->firstOrFail();
    $tr1250 = Driver::where('model', 'TR 1250 12"')->firstOrFail();

    expect($tr620->sd_m2)->toBe(0.05309)
        ->and($tr620->vas_m3)->toBe(0.026348)
        ->and($tr620->fs_hz)->toBe(76.94)
        ->and($tr620->xmax_m)->toBe(0.00635)
        ->and($tr620->nominal_diameter_m)->toBe(0.3048)
        ->and($tr1250->vas_m3)->toBe(0.022)
        ->and($tr1250->mms_kg)->toBe(0.09295)
        ->and($tr1250->le_h)->toBe(0.00112)
        ->and($tr1250->pe_w)->toBe(1250.0);
});

it('Fs, Qts e Vas existem e todo parâmetro está dentro das faixas do app', function () {
    foreach (Driver::all() as $driver) {
        foreach (['fs_hz', 'qts', 'vas_m3'] as $required) {
            expect($driver->{$required})->not->toBeNull();
        }

        foreach (RANGES as $key => [$min, $max]) {
            $value = $driver->{$key};

            if ($value === null) {
                continue;
            }

            expect($value)->toBeGreaterThanOrEqual($min, "{$driver->model}: {$key}")
                ->and($value)->toBeLessThanOrEqual($max, "{$driver->model}: {$key}");
        }
    }
});

it('gera o texto de busca sem acento e em minúsculas', function () {
    $driver = Driver::where('model', 'TR 620 12"')->firstOrFail();

    expect($driver->search_text)->toContain('triton')
        ->and($driver->search_text)->toContain('tr 620');
});
