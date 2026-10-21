<?php

use App\Models\Driver;
use Database\Seeders\DriverSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

function search(string $term): TestResponse
{
    return test()->getJson('/api/drivers?'.http_build_query(['q' => $term]));
}

it('acha pelo fabricante', function () {
    $this->seed(DriverSeeder::class);

    search('triton')->assertOk()->assertJsonCount(2, 'data');
});

it('exige todas as palavras', function () {
    $this->seed(DriverSeeder::class);

    search('tr 620')->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.model', 'TR 620 12"');
});

it('ignora caixa e acento', function () {
    Driver::factory()->create(['brand' => 'Áudio Fôrça', 'model' => 'Ñandú 15']);

    search('AUDIO forca')->assertOk()->assertJsonCount(1, 'data');
    search('nandu')->assertOk()->assertJsonCount(1, 'data');
    search('ÁUDIO')->assertOk()->assertJsonCount(1, 'data');
});

it('apara e colapsa espaços', function () {
    $this->seed(DriverSeeder::class);

    search('  tr   620 ')->assertOk()->assertJsonCount(1, 'data');
});

it('trata %, _ e ! como texto comum', function () {
    $this->seed(DriverSeeder::class);
    Driver::factory()->create(['brand' => 'Marca', 'model' => '100% real_x!']);

    search('tr%')->assertOk()->assertJsonCount(0, 'data');
    search('tr_')->assertOk()->assertJsonCount(0, 'data');
    search('0%')->assertOk()->assertJsonCount(1, 'data');
    search('%%')->assertOk()->assertJsonCount(0, 'data');
    search('l_x')->assertOk()->assertJsonCount(1, 'data');
    search('x!')->assertOk()->assertJsonCount(1, 'data');
    search('t!')->assertOk()->assertJsonCount(0, 'data');
});

it('limita a 20 resultados e avisa quando há mais', function () {
    Driver::factory()->count(21)->sequence(fn ($sequence) => [
        'brand' => 'Lote',
        'model' => sprintf('Modelo %02d', $sequence->index),
    ])->create();

    search('lote')->assertOk()
        ->assertJsonCount(20, 'data')
        ->assertJsonPath('meta.limit', 20)
        ->assertJsonPath('meta.has_more', true);
});

it('não avisa de mais resultados quando cabem todos', function () {
    Driver::factory()->count(20)->sequence(fn ($sequence) => [
        'brand' => 'Lote',
        'model' => sprintf('Modelo %02d', $sequence->index),
    ])->create();

    search('lote')->assertOk()
        ->assertJsonCount(20, 'data')
        ->assertJsonPath('meta.has_more', false);
});

it('ordena por fabricante, modelo, variação e id', function () {
    Driver::factory()->create(['brand' => 'Beta', 'model' => 'Mod X', 'variant' => '8 Ω']);
    Driver::factory()->create(['brand' => 'Beta', 'model' => 'Mod X', 'variant' => '4 Ω']);
    Driver::factory()->create(['brand' => 'Alfa', 'model' => 'Mod Z', 'variant' => '']);
    Driver::factory()->create(['brand' => 'Beta', 'model' => 'Mod A', 'variant' => '']);

    $order = collect(search('mod')->assertOk()->json('data'))
        ->map(fn (array $row) => trim("{$row['brand']} {$row['model']} {$row['variant']}"))
        ->all();

    expect($order)->toBe(['Alfa Mod Z', 'Beta Mod A', 'Beta Mod X 4 Ω', 'Beta Mod X 8 Ω']);
});

it('devolve só os campos do resultado, com variação vazia como null', function () {
    Driver::factory()->create([
        'brand' => 'Solo',
        'model' => 'S1',
        'variant' => '',
        'qes' => 0.5,
    ]);

    $row = search('solo')->assertOk()->json('data.0');

    expect(array_keys($row))->toBe(['id', 'brand', 'model', 'variant', 'fs_hz', 'qts', 'vas_m3'])
        ->and($row['variant'])->toBeNull();
});

it('recusa termo ausente, curto, longo ou que não é texto', function () {
    $this->getJson('/api/drivers')->assertUnprocessable()->assertJsonValidationErrors('q');
    search('a')->assertUnprocessable()->assertJsonValidationErrors('q');
    search(' a ')->assertUnprocessable()->assertJsonValidationErrors('q');
    search(str_repeat('a', 61))->assertUnprocessable()->assertJsonValidationErrors('q');
    $this->getJson('/api/drivers?q[]=tr')->assertUnprocessable()->assertJsonValidationErrors('q');
});

it('aceita o termo com exatamente 2 e 60 caracteres', function () {
    search('tr')->assertOk();
    search(str_repeat('a', 60))->assertOk();
});
