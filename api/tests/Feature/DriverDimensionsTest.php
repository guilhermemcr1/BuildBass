<?php

use App\Enums\AuditType;
use App\Filament\Resources\Drivers\Pages\CreateDriver;
use App\Filament\Resources\Drivers\Pages\EditDriver;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\Moderator;
use App\Services\DriverService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;

uses(RefreshDatabase::class);

/** @return array<string, mixed> */
function dimensionData(array $overrides = []): array
{
    return array_merge(
        Driver::factory()->withDimensions()->make(['brand' => 'Triton', 'model' => 'TR 620'])->only([
            'brand', 'model', 'variant', 'type', 'nominal_diameter_m', 'fs_hz', 'qts', 'vas_m3', 'source',
            ...Driver::DIMENSION_FIELDS,
        ]),
        $overrides,
    );
}

it('grava formato, pistão e cotas no cadastro e leva tudo ao snapshot da auditoria', function () {
    $driver = app(DriverService::class)->create(dimensionData(), Moderator::factory()->create());

    $fresh = $driver->fresh();
    expect($fresh->drv_shape)->toBe('round')
        ->and($fresh->drv_piston)->toBe('cone')
        ->and($fresh->drv_a_m)->toBe(0.27)
        ->and($fresh->cutout_m)->toBe(0.24)
        ->and($fresh->drv_g_m)->toBe(0.12);

    $snapshot = AuditEvent::query()->sole()->snapshot;
    expect($snapshot['drv_a_m'])->toBe(0.27)->and($snapshot['drv_shape'])->toBe('round');
});

it('as medidas são opcionais e vazio vira nulo', function () {
    $driver = app(DriverService::class)->create(
        dimensionData(array_fill_keys(Driver::DIMENSION_FIELDS, '')),
        Moderator::factory()->create(),
    );

    foreach (Driver::DIMENSION_FIELDS as $key) {
        expect($driver->fresh()->{$key})->toBeNull();
    }
});

it('recusa cota fora da faixa, formato e pistão desconhecidos', function (string $key, mixed $value) {
    expect(fn () => app(DriverService::class)->create(dimensionData([$key => $value]), Moderator::factory()->create()))
        ->toThrow(ValidationException::class);

    expect(Driver::count())->toBe(0);
})->with([
    'A abaixo' => ['drv_a_m', 0.01],
    'A acima' => ['drv_a_m', 2],
    'C acima' => ['cutout_m', 1.5],
    'F acima' => ['drv_f_m', 0.5],
    'G abaixo' => ['drv_g_m', 0.001],
    'formato' => ['drv_shape', 'oval'],
    'pistão' => ['drv_piston', 'cone-duplo'],
]);

it('só o formato retangular guarda a cota D', function (string $shape) {
    $driver = app(DriverService::class)->create(dimensionData(['drv_shape' => $shape, 'drv_d_m' => 0.3]), Moderator::factory()->create());

    expect($driver->fresh()->drv_d_m)->toBeNull();
})->with(['round', 'square']);

it('formato retangular guarda a cota D', function () {
    $driver = app(DriverService::class)->create(dimensionData(['drv_shape' => 'rect', 'drv_d_m' => 0.3]), Moderator::factory()->create());

    expect($driver->fresh()->drv_d_m)->toBe(0.3);
});

it('editar uma cota grava só ela em driver_updated', function () {
    $driver = Driver::factory()->withDimensions()->create();

    app(DriverService::class)->update($driver, ['drv_g_m' => 0.15], Moderator::factory()->create());

    $event = AuditEvent::query()->sole();
    expect($event->type)->toBe(AuditType::DriverUpdated)
        ->and($event->changes)->toBe(['drv_g_m' => [0.12, 0.15]]);
});

it('o painel cria e edita o driver com as medidas', function () {
    signInModerator();

    Livewire::test(CreateDriver::class)
        // O formulário fala a unidade das fichas: o diâmetro é digitado em mm.
        ->fillForm(dimensionData(['drv_shape' => 'rect', 'drv_d_m' => 0.2, 'nominal_diameter_m' => 304.8]))
        ->call('create')
        ->assertHasNoFormErrors();

    $driver = Driver::query()->sole();
    expect($driver->drv_shape)->toBe('rect')->and($driver->drv_d_m)->toBe(0.2);

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->assertFormSet(['drv_a_m' => 0.27, 'cutout_m' => 0.24])
        ->fillForm(['cutout_m' => 0.25])
        ->call('save')
        ->assertHasNoFormErrors();

    expect($driver->fresh()->cutout_m)->toBe(0.25);
});

it('o painel recusa cota fora da faixa no campo', function () {
    signInModerator();

    Livewire::test(CreateDriver::class)
        ->fillForm(dimensionData(['drv_a_m' => 5]))
        ->call('create')
        ->assertHasFormErrors(['drv_a_m']);
});

it('a cota D some do formulário quando o formato é redondo', function () {
    signInModerator();

    Livewire::test(CreateDriver::class)
        ->fillForm(['drv_shape' => 'round'])
        ->assertFormFieldHidden('drv_d_m')
        ->fillForm(['drv_shape' => 'rect'])
        ->assertFormFieldVisible('drv_d_m');
});

it('a API devolve as medidas preenchidas e omite as vazias', function () {
    $driver = Driver::factory()->withDimensions()->create();
    $plain = Driver::factory()->create();

    $data = $this->getJson("/api/drivers/{$driver->id}")->assertOk()->json('data');
    expect($data['drv_shape'])->toBe('round')
        ->and($data['drv_piston'])->toBe('cone')
        ->and($data['drv_a_m'])->toBe(0.27)
        ->and($data['cutout_m'])->toBe(0.24)
        ->and($data)->not->toHaveKey('drv_d_m');

    $this->getJson("/api/drivers/{$plain->id}")->assertOk()
        ->assertJsonMissingPath('data.drv_shape')
        ->assertJsonMissingPath('data.cutout_m');
});
