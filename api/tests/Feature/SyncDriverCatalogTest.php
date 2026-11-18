<?php

use App\Enums\DriverOrigin;
use App\Models\Driver;
use Database\Seeders\Support\DriverCatalogFiles;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function catalogTotal(): int
{
    return count(DriverCatalogFiles::all());
}

it('--dry-run relata e não grava nada', function () {
    $this->artisan('drivers:sync-catalog', ['--dry-run' => true])
        ->expectsOutputToContain('Simulação: nada foi gravado.')
        ->expectsOutputToContain(catalogTotal().' a criar')
        ->assertSuccessful();

    expect(Driver::count())->toBe(0);
});

it('grava o catálogo e, rodando de novo, não muda nada', function () {
    $this->artisan('drivers:sync-catalog')->assertSuccessful();

    expect(Driver::count())->toBe(catalogTotal());

    $this->artisan('drivers:sync-catalog', ['--dry-run' => true])
        ->expectsOutputToContain('0 a criar, 0 a atualizar, 0 renomeados, '.catalogTotal().' sem mudança')
        ->assertSuccessful();
});

it('corrige valor errado da carga anterior e renomeia grafia diferente em vez de duplicar', function () {
    $this->artisan('drivers:sync-catalog')->assertSuccessful();
    $tr620 = Driver::where('model', 'TR 620 12"')->firstOrFail();
    $tr620->update(['fs_hz' => 1, 'model' => 'TR  620 12"']);

    $this->artisan('drivers:sync-catalog', ['--dry-run' => true])
        ->expectsOutputToContain('Triton TR  620 12" 4 Ω → Triton TR 620 12" 4 Ω')
        ->expectsOutputToContain('Triton TR 620 12" 4 Ω: fs_hz')
        ->assertSuccessful();

    $this->artisan('drivers:sync-catalog')->assertSuccessful();

    expect(Driver::count())->toBe(catalogTotal())
        ->and($tr620->fresh()->model)->toBe('TR 620 12"')
        ->and($tr620->fresh()->fs_hz)->toBe(76.94);
});

it('só com --prune apaga a carga inicial que saiu do catálogo, e nunca o que é do painel', function () {
    $this->artisan('drivers:sync-catalog')->assertSuccessful();
    $stale = Driver::factory()->create(['brand' => 'Antiga', 'model' => 'X 12"', 'origin' => DriverOrigin::InitialLoad]);
    $mine = Driver::factory()->create(['brand' => 'Painel', 'model' => 'Y 12"', 'origin' => DriverOrigin::Direct]);

    $this->artisan('drivers:sync-catalog')->expectsOutputToContain('use --prune para apagar')->assertSuccessful();
    expect($stale->fresh())->not->toBeNull();

    $this->artisan('drivers:sync-catalog', ['--prune' => true])->assertSuccessful();

    expect($stale->fresh())->toBeNull()
        ->and($mine->fresh())->not->toBeNull();
});

it('não toca no que o moderador corrigiu, e aponta variante fora do padrão', function () {
    $this->artisan('drivers:sync-catalog')->assertSuccessful();
    $fixed = Driver::where('model', 'TR 620 12"')->firstOrFail();
    $fixed->update(['fs_hz' => 50, 'origin' => DriverOrigin::Direct]);
    Driver::factory()->create(['brand' => 'Painel', 'model' => 'Z 12"', 'variant' => 'Dual 4', 'origin' => DriverOrigin::Direct]);

    $this->artisan('drivers:sync-catalog')
        ->expectsOutputToContain('Protegidos')
        ->expectsOutputToContain('Painel Z 12" Dual 4 [direct]: variante fora do padrão')
        ->assertSuccessful();

    expect($fixed->fresh()->fs_hz)->toBe(50.0);
});
