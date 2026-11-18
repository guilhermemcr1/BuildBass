<?php

use App\Models\Driver;
use App\Services\DriverCatalogService;
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

    $brands = search('triton')->assertOk()->json('data.*.brand');

    expect($brands)->not->toBeEmpty()
        ->and(array_unique($brands))->toBe(['Triton']);
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

    expect(array_keys($row))->toBe(['id', 'brand', 'model', 'variant', 'nominal_diameter_m', 'fs_hz', 'qts', 'vas_m3'])
        ->and($row['variant'])->toBeNull()
        ->and($row['id'])->toBeUuid();
});

it('recusa termo longo ou que não é texto', function () {
    search(str_repeat('a', 61))->assertUnprocessable()->assertJsonValidationErrors('q');
    $this->getJson('/api/drivers?q[]=tr')->assertUnprocessable()->assertJsonValidationErrors('q');
});

it('aceita termo ausente, de 1 e de 60 caracteres', function () {
    $this->getJson('/api/drivers')->assertOk();
    search('a')->assertOk();
    search(str_repeat('a', 60))->assertOk();
});

it('sem termo lista o catálogo em ordem alfabética', function () {
    Driver::factory()->create(['brand' => 'Zeta', 'model' => 'Z1']);
    Driver::factory()->create(['brand' => 'Alfa', 'model' => 'A1']);

    expect(test()->getJson('/api/drivers')->assertOk()->json('data.*.brand'))->toBe(['Alfa', 'Zeta']);
});

it('ignora pontuação e acha pelo tipo', function () {
    Driver::factory()->create(['brand' => 'Pioneer', 'model' => 'TS-W3010', 'variant' => '', 'type' => 'subwoofer']);
    Driver::factory()->create(['brand' => 'Pioneer', 'model' => 'TS-M800', 'variant' => '', 'type' => 'midbass']);

    expect(search('tsw3010')->json('data.*.model'))->toBe(['TS-W3010'])
        ->and(search('ts w3010')->json('data.*.model'))->toBe(['TS-W3010'])
        ->and(search('pioneer sub')->json('data.*.model'))->toBe(['TS-W3010']);
});

it('pagina com offset', function () {
    foreach (range(1, DriverCatalogService::LIMIT + 5) as $n) {
        Driver::factory()->create(['brand' => 'Pagina', 'model' => sprintf('P%02d', $n)]);
    }

    $first = test()->getJson('/api/drivers?q=pagina')->assertOk();
    $next = test()->getJson('/api/drivers?q=pagina&offset='.DriverCatalogService::LIMIT)->assertOk();

    expect($first->json('meta.has_more'))->toBeTrue()
        ->and($next->json('data.*.model'))->toBe(['P21', 'P22', 'P23', 'P24', 'P25'])
        ->and($next->json('meta.has_more'))->toBeFalse();

    test()->getJson('/api/drivers?offset=-1')->assertUnprocessable()->assertJsonValidationErrors('offset');
    test()->getJson('/api/drivers?offset=1001')->assertUnprocessable()->assertJsonValidationErrors('offset');
});
