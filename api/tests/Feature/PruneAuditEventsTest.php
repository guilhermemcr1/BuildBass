<?php

use App\Models\AuditEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('apaga só o que passou do prazo de retenção', function () {
    config(['audit.retention_days' => 180]);
    $old = AuditEvent::factory()->create(['created_at' => now()->subDays(181)]);
    $edge = AuditEvent::factory()->create(['created_at' => now()->subDays(179)]);
    $new = AuditEvent::factory()->create(['created_at' => now()]);

    $this->artisan('audit:prune')->expectsOutputToContain('1 evento(s)')->assertSuccessful();

    expect(AuditEvent::find($old->id))->toBeNull()
        ->and(AuditEvent::find($edge->id))->not->toBeNull()
        ->and(AuditEvent::find($new->id))->not->toBeNull();
});

it('respeita o prazo configurado', function () {
    config(['audit.retention_days' => 7]);
    $eight = AuditEvent::factory()->create(['created_at' => now()->subDays(8)]);
    $six = AuditEvent::factory()->create(['created_at' => now()->subDays(6)]);

    $this->artisan('audit:prune')->assertSuccessful();

    expect(AuditEvent::find($eight->id))->toBeNull()->and(AuditEvent::find($six->id))->not->toBeNull();
});

it('apaga em blocos quando há muitos eventos', function () {
    config(['audit.retention_days' => 1]);
    AuditEvent::factory()->count(1500)->create(['created_at' => now()->subDays(5)]);

    $this->artisan('audit:prune')->expectsOutputToContain('1500 evento(s)');

    expect(AuditEvent::count())->toBe(0);
});

it('sem eventos antigos não apaga nada', function () {
    AuditEvent::factory()->count(2)->create();

    $this->artisan('audit:prune')->expectsOutputToContain('0 evento(s)')->assertSuccessful();

    expect(AuditEvent::count())->toBe(2);
});

it('está agendado todo dia', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn ($event) => str_contains((string) $event->command, 'audit:prune'));

    expect($event)->not->toBeNull()->and($event->expression)->toBe('0 0 * * *');
});
