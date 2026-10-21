<?php

use App\Models\Driver;
use App\Models\DriverSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function sample(array $overrides = []): array
{
    return array_merge([
        'brand' => 'Exemplo Áudio',
        'model' => 'EX-12',
        'variant' => '4 Ω',
        'source' => 'Ficha',
        'fs_hz' => 40,
        'qts' => 0.4,
        'vas_m3' => 0.05,
    ], $overrides);
}

it('recusa driver que já está no catálogo, ignorando caixa, acento e espaços repetidos', function (array $variant) {
    Driver::factory()->create(['brand' => 'Exemplo Áudio', 'model' => 'EX-12', 'variant' => '4 Ω']);

    $this->postJson('/api/driver-submissions', sample($variant))
        ->assertStatus(409)
        ->assertJsonPath('code', 'already_in_catalog');

    expect(DriverSubmission::count())->toBe(0);
})->with([
    'igual' => [[]],
    'caixa' => [['brand' => 'EXEMPLO ÁUDIO', 'model' => 'ex-12']],
    'sem acento' => [['brand' => 'Exemplo Audio']],
    'espaços' => [['brand' => '  Exemplo   Áudio ', 'model' => 'EX-12  ']],
]);

it('recusa driver que já está em análise na fila', function () {
    DriverSubmission::factory()->create(['brand' => 'Exemplo Áudio', 'model' => 'EX-12', 'variant' => '4 Ω']);

    $this->postJson('/api/driver-submissions', sample(['brand' => 'EXEMPLO AUDIO']))
        ->assertStatus(409)
        ->assertJsonPath('code', 'already_pending');

    expect(DriverSubmission::count())->toBe(1);
});

it('a variante diferente não é duplicata', function () {
    Driver::factory()->create(['brand' => 'Exemplo Áudio', 'model' => 'EX-12', 'variant' => '4 Ω']);

    $this->postJson('/api/driver-submissions', sample(['variant' => '8 Ω']))->assertCreated();
});

it('um envio rejeitado não bloqueia novo envio corrigido', function () {
    DriverSubmission::factory()->rejected()->create(['brand' => 'Exemplo Áudio', 'model' => 'EX-12', 'variant' => '4 Ω']);

    $this->postJson('/api/driver-submissions', sample())->assertCreated();

    expect(DriverSubmission::count())->toBe(2);
});

it('um envio já aprovado cai em "já está no catálogo"', function () {
    $driver = Driver::factory()->create(['brand' => 'Exemplo Áudio', 'model' => 'EX-12', 'variant' => '4 Ω']);
    DriverSubmission::factory()->approved()->create([
        'brand' => 'Exemplo Áudio', 'model' => 'EX-12', 'variant' => '4 Ω', 'driver_id' => $driver->id,
    ]);

    $this->postJson('/api/driver-submissions', sample())
        ->assertStatus(409)
        ->assertJsonPath('code', 'already_in_catalog');
});
