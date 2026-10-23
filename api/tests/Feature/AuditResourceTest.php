<?php

use App\Enums\AuditType;
use App\Filament\Resources\AuditEvents\AuditEventResource;
use App\Filament\Resources\AuditEvents\Pages\ListAuditEvents;
use App\Filament\Resources\AuditEvents\Pages\ViewAuditEvent;
use App\Models\AuditEvent;
use App\Models\Moderator;
use App\Services\Audit\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;

uses(RefreshDatabase::class);

beforeEach(function () {
    signInModerator();
});

it('manda o visitante sem sessão para o login', function () {
    auth('moderator')->logout();

    $this->get('/moderation/auditoria')->assertRedirect('/moderation/login');
});

it('lista do mais recente ao mais antigo, 25 por página', function () {
    $old = AuditEvent::factory()->create(['created_at' => now()->subDays(2)]);
    $new = AuditEvent::factory()->create(['created_at' => now()->subMinute()]);
    $mid = AuditEvent::factory()->create(['created_at' => now()->subDay()]);

    Livewire::test(ListAuditEvents::class)
        ->assertCanSeeTableRecords([$new, $mid, $old], inOrder: true);

    AuditEvent::factory()->count(30)->create();
    Livewire::test(ListAuditEvents::class)->assertCountTableRecords(33);
});

it('filtra por tipo', function () {
    $login = AuditEvent::factory()->login()->create();
    $update = AuditEvent::factory()->create();

    Livewire::test(ListAuditEvents::class)
        ->filterTable('type', AuditType::Login->value)
        ->assertCanSeeTableRecords([$login])
        ->assertCanNotSeeTableRecords([$update]);
});

it('filtra por autor pelo e-mail guardado no evento', function () {
    $ana = AuditEvent::factory()->create(['actor_id' => fake()->uuid(), 'actor_name' => 'Ana', 'actor_email' => 'ana@exemplo.com']);
    $bia = AuditEvent::factory()->create(['actor_id' => fake()->uuid(), 'actor_name' => 'Bia', 'actor_email' => 'bia@exemplo.com']);

    Livewire::test(ListAuditEvents::class)
        ->filterTable('actor_email', 'ana@exemplo.com')
        ->assertCanSeeTableRecords([$ana])
        ->assertCanNotSeeTableRecords([$bia]);
});

it('filtra por período, incluindo o dia final inteiro', function () {
    $before = AuditEvent::factory()->create(['created_at' => '2026-10-01 10:00:00']);
    $inside = AuditEvent::factory()->create(['created_at' => '2026-10-10 23:30:00']);
    $after = AuditEvent::factory()->create(['created_at' => '2026-10-11 00:10:00']);

    Livewire::test(ListAuditEvents::class)
        ->filterTable('period', ['from' => '2026-10-05', 'until' => '2026-10-10'])
        ->assertCanSeeTableRecords([$inside])
        ->assertCanNotSeeTableRecords([$before, $after]);
});

it('combina tipo, autor e período', function () {
    $match = AuditEvent::factory()->create(['actor_email' => 'ana@exemplo.com', 'actor_id' => fake()->uuid(), 'created_at' => '2026-10-10 12:00:00']);
    $otherType = AuditEvent::factory()->login()->create(['actor_email' => 'ana@exemplo.com', 'actor_id' => fake()->uuid(), 'created_at' => '2026-10-10 12:00:00']);
    $otherActor = AuditEvent::factory()->create(['actor_email' => 'bia@exemplo.com', 'actor_id' => fake()->uuid(), 'created_at' => '2026-10-10 12:00:00']);
    $otherDay = AuditEvent::factory()->create(['actor_email' => 'ana@exemplo.com', 'actor_id' => fake()->uuid(), 'created_at' => '2026-09-01 12:00:00']);

    Livewire::test(ListAuditEvents::class)
        ->filterTable('type', AuditType::DriverUpdated->value)
        ->filterTable('actor_email', 'ana@exemplo.com')
        ->filterTable('period', ['from' => '2026-10-01', 'until' => '2026-10-31'])
        ->assertCanSeeTableRecords([$match])
        ->assertCanNotSeeTableRecords([$otherType, $otherActor, $otherDay]);
});

it('o detalhe mostra antes e depois e o conteúdo registrado', function () {
    $update = AuditEvent::factory()->create(['changes' => ['qts' => [0.4, 0.55]]]);
    $deleted = AuditEvent::factory()->create([
        'type' => AuditType::DriverDeleted, 'changes' => null, 'snapshot' => ['brand' => 'Triton', 'model' => 'TR 620'],
    ]);

    Livewire::test(ViewAuditEvent::class, ['record' => $update->getRouteKey()])
        ->assertSee('qts')
        ->assertSee('0.4 → 0.55');

    Livewire::test(ViewAuditEvent::class, ['record' => $deleted->getRouteKey()])
        ->assertSee('Triton')
        ->assertSee('TR 620');
});

it('não tem como criar, editar ou excluir eventos', function () {
    $event = AuditEvent::factory()->create();

    expect(AuditEventResource::canCreate())->toBeFalse()
        ->and(AuditEventResource::canEdit($event))->toBeFalse()
        ->and(AuditEventResource::canDelete($event))->toBeFalse()
        ->and(AuditEventResource::canDeleteAny())->toBeFalse()
        ->and(array_keys(AuditEventResource::getPages()))->toBe(['index', 'view']);

    $this->get('/moderation/auditoria/create')->assertNotFound();
    $this->get("/moderation/auditoria/{$event->id}/edit")->assertNotFound();
});

it('eventos de um moderador removido continuam com o nome e o e-mail da época', function () {
    $moderator = Moderator::factory()->create(['name' => 'Ana', 'email' => 'ana@exemplo.com']);
    $event = app(AuditLogger::class)->record(AuditType::DriverCreated, [], $moderator);
    $moderator->delete();

    Livewire::test(ListAuditEvents::class)
        ->assertCanSeeTableRecords([$event])
        ->assertSee('Ana')
        ->assertSee('ana@exemplo.com');
});

it('mostra só o hash do IP, truncado, no detalhe', function () {
    $event = AuditEvent::factory()->login()->create();

    Livewire::test(ViewAuditEvent::class, ['record' => $event->getRouteKey()])
        ->assertSee(substr($event->ip_hash, 0, 12))
        ->assertDontSee($event->ip_hash);
});
