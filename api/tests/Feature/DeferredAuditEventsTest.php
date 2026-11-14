<?php

use App\Enums\AuditType;
use App\Models\AuditEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

// Sem `withoutDefer()`: os eventos públicos passam pelo middleware real do `defer()`, que por
// padrão descarta o callback quando a resposta é 4xx/5xx. Bloqueios e falhas também são trilha.
it('bloqueio com resposta de erro (503) ainda grava manual_blocked', function () {
    config(['manual_extraction.enabled' => false]);

    postManual()->assertStatus(503);

    expect(AuditEvent::where('type', AuditType::ManualBlocked)->sole()->reason)->toBe('unavailable');
});

it('falha de leitura com resposta de erro (422) ainda grava manual_read com falha', function () {
    fakeManualPipeline(pages: 99);

    postManual()->assertStatus(422);

    expect(AuditEvent::where('type', AuditType::ManualRead)->sole()->outcome)->toBe('failed');
});
