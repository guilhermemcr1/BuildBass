<?php

use App\Models\Driver;
use Database\Seeders\DriverSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('devolve todos os parâmetros em SI, idênticos ao cadastro', function () {
    $this->seed(DriverSeeder::class);
    $driver = Driver::where('model', 'TR 620 12"')->firstOrFail();

    $response = $this->getJson("/api/drivers/{$driver->id}")->assertOk();
    $data = $response->json('data');

    expect($data['id'])->toBe($driver->id)
        ->and($data['brand'])->toBe('Triton')
        ->and($data['variant'])->toBe('4 Ω')
        ->and($data['fs_hz'])->toBe(76.94)
        ->and($data['qts'])->toBe(0.717)
        ->and($data['qes'])->toBe(0.779)
        ->and($data['qms'])->toBe(8.978)
        ->and($data['vas_m3'])->toBe(0.026348)
        ->and($data['re_ohm'])->toEqual(3)
        ->and($data['le_h'])->toBe(0.000607)
        ->and($data['xmax_m'])->toBe(0.00635)
        ->and($data['sd_m2'])->toBe(0.05309)
        ->and($data['pe_w'])->toEqual(620)
        ->and($data['bl_tm'])->toBe(10.9)
        ->and($data['mms_kg'])->toBe(0.06392)
        ->and($data['vd_m3'])->toBe(0.000333)
        ->and($data['nominal_diameter_m'])->toBe(0.3048)
        ->and($data['source'])->toContain('TR 620');
});

it('omite os campos sem valor e os internos', function () {
    $driver = Driver::factory()->create([
        'qes' => null, 'qms' => null, 're_ohm' => null, 'le_h' => null, 'xmax_m' => null,
        'sd_m2' => null, 'pe_w' => null, 'bl_tm' => null, 'mms_kg' => null, 'vd_m3' => null,
        'nominal_diameter_m' => null, 'variant' => '',
    ]);

    $data = $this->getJson("/api/drivers/{$driver->id}")->assertOk()->json('data');

    expect(array_keys($data))->toBe(['id', 'brand', 'model', 'variant', 'fs_hz', 'qts', 'vas_m3', 'source'])
        ->and($data['variant'])->toBeNull()
        ->and($data)->not->toHaveKeys(['search_text', 'created_at', 'updated_at']);
});

it('responde 404 para id que não existe, sem vazar detalhes internos', function () {
    $response = $this->getJson('/api/drivers/999')->assertNotFound();

    expect($response->getContent())->not->toContain('App\\Models');
});

it('recusa id que não é inteiro positivo', function () {
    $this->getJson('/api/drivers/abc')->assertUnprocessable()->assertJsonValidationErrors('id');
    $this->getJson('/api/drivers/0')->assertUnprocessable()->assertJsonValidationErrors('id');
    $this->getJson('/api/drivers/1.5')->assertUnprocessable()->assertJsonValidationErrors('id');
});
