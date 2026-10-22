<?php

use App\Models\Driver;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    Driver::factory()->create(['brand' => 'Alfa', 'model' => 'A8', 'type' => 'woofer', 'nominal_diameter_m' => 0.2032]);
    Driver::factory()->create(['brand' => 'Alfa', 'model' => 'A12', 'type' => 'subwoofer', 'nominal_diameter_m' => 0.3048]);
    Driver::factory()->create(['brand' => 'Beta', 'model' => 'B12', 'type' => 'subwoofer', 'nominal_diameter_m' => 0.3048]);
    Driver::factory()->create(['brand' => 'Beta', 'model' => 'B15', 'type' => null, 'nominal_diameter_m' => null]);
});

function models(string $query): array
{
    return collect(test()->getJson("/api/drivers?{$query}")->assertOk()->json('data'))->pluck('model')->all();
}

it('lista só com um filtro, sem texto', function () {
    expect(models('brand=Alfa'))->toBe(['A12', 'A8'])
        ->and(models('type=subwoofer'))->toBe(['A12', 'B12']);
});

it('filtra por faixa de diâmetro, com o máximo exclusivo e sem driver sem diâmetro', function () {
    expect(models('diameter_min_m=0.28&diameter_max_m=0.33'))->toBe(['A12', 'B12'])
        ->and(models('diameter_max_m=0.3048'))->toBe(['A8'])
        ->and(models('diameter_min_m=0.3048'))->toBe(['A12', 'B12']);
});

it('soma os filtros ao termo', function () {
    expect(models('q=12&brand=Beta'))->toBe(['B12'])
        ->and(models('q=a1&brand=Beta'))->toBe([]);
});

it('o resumo traz o tipo e o diâmetro só quando existem', function () {
    $rows = collect($this->getJson('/api/drivers?brand=Beta')->assertOk()->json('data'))->keyBy('model');

    expect($rows['B12']['type'])->toBe('subwoofer')
        ->and($rows['B12']['nominal_diameter_m'])->toBe(0.3048)
        ->and($rows['B15'])->not->toHaveKeys(['type', 'nominal_diameter_m']);
});

it('recusa tipo desconhecido, diâmetro fora da faixa e busca sem nada', function () {
    $this->getJson('/api/drivers?type=tuba')->assertUnprocessable()->assertJsonValidationErrors('type');
    $this->getJson('/api/drivers?diameter_min_m=5')->assertUnprocessable()->assertJsonValidationErrors('diameter_min_m');
    $this->getJson('/api/drivers')->assertUnprocessable()->assertJsonValidationErrors('q');
});

it('lista as marcas em ordem, sem repetir', function () {
    $this->getJson('/api/driver-brands')->assertOk()->assertExactJson(['data' => ['Alfa', 'Beta']]);
});
