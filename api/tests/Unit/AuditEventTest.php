<?php

use App\Enums\AuditType;
use App\Models\AuditEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('grava com id uuid e momento, sem updated_at', function () {
    $event = AuditEvent::factory()->create();

    expect(Str::isUuid($event->id))->toBeTrue()
        ->and($event->created_at)->not->toBeNull()
        ->and($event->type)->toBe(AuditType::DriverUpdated)
        ->and(array_key_exists('updated_at', $event->getAttributes()))->toBeFalse();
});

it('não deixa editar nem excluir um evento', function () {
    $event = AuditEvent::factory()->create();

    expect(fn () => $event->update(['reason' => 'x']))->toThrow(LogicException::class)
        ->and(fn () => $event->delete())->toThrow(LogicException::class);

    expect(AuditEvent::count())->toBe(1);
});
