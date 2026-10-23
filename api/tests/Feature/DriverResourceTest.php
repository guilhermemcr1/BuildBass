<?php

use App\Enums\AuditType;
use App\Enums\DriverOrigin;
use App\Filament\Resources\Drivers\Pages\CreateDriver;
use App\Filament\Resources\Drivers\Pages\EditDriver;
use App\Filament\Resources\Drivers\Pages\ListDrivers;
use App\Models\AuditEvent;
use App\Models\Driver;
use Filament\Actions\Testing\TestAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;

uses(RefreshDatabase::class);

it('manda o visitante sem sessão para o login', function () {
    $this->get('/moderation/drivers')->assertRedirect('/moderation/login');
});

it('abre a lista para o moderador', function () {
    signInModerator();

    $this->get('/moderation/drivers')->assertOk();
});

it('lista o catálogo ordenado por fabricante, modelo e variante, 25 por página', function () {
    signInModerator();
    $b = Driver::factory()->create(['brand' => 'B', 'model' => 'A']);
    $a2 = Driver::factory()->create(['brand' => 'A', 'model' => 'Z']);
    $a1 = Driver::factory()->create(['brand' => 'A', 'model' => 'M']);

    Livewire::test(ListDrivers::class)
        ->assertCanSeeTableRecords([$a1, $a2, $b], inOrder: true);

    Driver::factory()->count(30)->create();
    Livewire::test(ListDrivers::class)->assertCountTableRecords(33);
});

it('busca por palavras sem acento e sem caixa', function () {
    signInModerator();
    $triton = Driver::factory()->create(['brand' => 'Tritón', 'model' => 'TR 620']);
    $other = Driver::factory()->create(['brand' => 'Seas', 'model' => 'W18']);

    Livewire::test(ListDrivers::class)
        ->searchTable('triton 620')
        ->assertCanSeeTableRecords([$triton])
        ->assertCanNotSeeTableRecords([$other])
        ->searchTable('TRITON')
        ->assertCanSeeTableRecords([$triton])
        ->assertCanNotSeeTableRecords([$other]);
});

it('filtra por tipo, por sem tipo e por origem, e limpa os filtros', function () {
    signInModerator();
    $woofer = Driver::factory()->create(['type' => 'woofer']);
    $sub = Driver::factory()->direct()->create(['type' => 'subwoofer']);
    $untyped = Driver::factory()->approved()->create(['type' => null]);

    Livewire::test(ListDrivers::class)
        ->filterTable('type', 'woofer')
        ->assertCanSeeTableRecords([$woofer])
        ->assertCanNotSeeTableRecords([$sub, $untyped])
        ->resetTableFilters()
        ->filterTable('type', 'none')
        ->assertCanSeeTableRecords([$untyped])
        ->assertCanNotSeeTableRecords([$woofer, $sub])
        ->resetTableFilters()
        ->filterTable('origin', DriverOrigin::Direct->value)
        ->assertCanSeeTableRecords([$sub])
        ->assertCanNotSeeTableRecords([$woofer, $untyped])
        ->filterTable('type', 'woofer')
        ->assertCountTableRecords(0)
        ->resetTableFilters()
        ->assertCountTableRecords(3);
});

it('ordena pelas colunas', function () {
    signInModerator();
    $low = Driver::factory()->create(['qts' => 0.2]);
    $high = Driver::factory()->create(['qts' => 0.9]);

    Livewire::test(ListDrivers::class)
        ->sortTable('qts')
        ->assertCanSeeTableRecords([$low, $high], inOrder: true)
        ->sortTable('qts', 'desc')
        ->assertCanSeeTableRecords([$high, $low], inOrder: true);
});

it('cria um driver com origem de cadastro direto e registra a auditoria', function () {
    $moderator = signInModerator();

    Livewire::test(CreateDriver::class)
        ->fillForm([
            'brand' => 'Triton', 'model' => 'TR 620', 'type' => 'woofer', 'source' => 'Ficha técnica',
            'fs_hz' => 76.94, 'qts' => 0.717, 'vas_m3' => 0.026348,
        ])
        ->call('create')
        ->assertHasNoFormErrors();

    $driver = Driver::query()->sole();
    expect($driver->origin)->toBe(DriverOrigin::Direct)
        ->and(AuditEvent::query()->sole()->actor_id)->toBe($moderator->id);
});

it('mostra erro de obrigatório e de faixa nos campos', function () {
    signInModerator();

    Livewire::test(CreateDriver::class)
        ->fillForm(['brand' => 'Triton', 'model' => 'TR 620', 'source' => 'Ficha técnica', 'qts' => 50, 'vas_m3' => 0.03])
        ->call('create')
        ->assertHasFormErrors(['fs_hz' => 'required', 'qts' => 'max']);

    expect(Driver::count())->toBe(0);
});

it('recusa duplicata sem criar nada', function () {
    signInModerator();
    Driver::factory()->create(['brand' => 'Triton', 'model' => 'TR 620']);

    Livewire::test(CreateDriver::class)
        ->fillForm([
            'brand' => 'Triton', 'model' => 'TR 620', 'source' => 'Ficha técnica',
            'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.08,
        ])
        ->call('create')
        ->assertNotified('Driver já cadastrado')
        ->assertHasFormErrors(['brand', 'model']);

    expect(Driver::count())->toBe(1)->and(AuditEvent::count())->toBe(0);
});

it('edita e o valor vale na API pública; a origem não muda', function () {
    signInModerator();
    $driver = Driver::factory()->create(['qts' => 0.4]);

    Livewire::test(EditDriver::class, ['record' => $driver->getRouteKey()])
        ->assertFormSet(['qts' => 0.4])
        ->fillForm(['qts' => 0.55])
        ->call('save')
        ->assertHasNoFormErrors();

    $this->getJson("/api/drivers/{$driver->id}")->assertJsonPath('data.qts', 0.55);
    expect($driver->fresh()->origin)->toBe(DriverOrigin::InitialLoad)
        ->and(AuditEvent::query()->sole()->type)->toBe(AuditType::DriverUpdated);
});

it('exclui só depois da confirmação, citando fabricante e modelo', function () {
    signInModerator();
    $driver = Driver::factory()->create(['brand' => 'Triton', 'model' => 'TR 620']);

    Livewire::test(ListDrivers::class)
        ->mountAction(TestAction::make('delete')->table($driver))
        ->assertActionMounted(TestAction::make('delete')->table($driver));

    expect(Driver::count())->toBe(1);

    Livewire::test(ListDrivers::class)
        ->callAction(TestAction::make('delete')->table($driver))
        ->assertNotified();

    expect(Driver::count())->toBe(0)
        ->and(AuditEvent::query()->sole()->type)->toBe(AuditType::DriverDeleted);
    $this->getJson("/api/drivers/{$driver->id}")->assertNotFound();
});

it('exclui em lote e gera um evento por driver', function () {
    signInModerator();
    $drivers = Driver::factory()->count(3)->create();

    Livewire::test(ListDrivers::class)
        ->selectTableRecords($drivers->pluck('id')->all())
        ->callAction(TestAction::make('delete')->table()->bulk());

    expect(Driver::count())->toBe(0)
        ->and(AuditEvent::where('type', AuditType::DriverDeleted)->count())->toBe(3);
});
