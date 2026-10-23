<?php

use App\Enums\AuditType;
use App\Filament\Resources\DriverSubmissions\Pages\EditDriverSubmission;
use App\Models\AuditEvent;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Services\Audit\AuditLogger;
use App\Services\DriverSubmissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;

uses(RefreshDatabase::class);

it('aprovar grava submission_approved com o autor e o driver criado', function () {
    $moderator = Moderator::factory()->create();
    $submission = DriverSubmission::factory()->create(['brand' => 'Triton', 'model' => 'TR 620']);

    $driver = app(DriverSubmissionService::class)->approve($submission, $moderator);

    $event = AuditEvent::where('type', AuditType::SubmissionApproved)->sole();
    expect($event->actor_id)->toBe($moderator->id)
        ->and($event->subject_type)->toBe('submission')
        ->and($event->subject_id)->toBe($submission->id)
        ->and($event->subject_label)->toBe('Triton TR 620')
        ->and($event->snapshot)->toBe(['driver_id' => $driver->id]);
});

it('rejeitar grava submission_rejected com o motivo', function () {
    $moderator = Moderator::factory()->create();
    $submission = DriverSubmission::factory()->create();

    app(DriverSubmissionService::class)->reject($submission, $moderator, 'Dados não conferem.');

    $event = AuditEvent::where('type', AuditType::SubmissionRejected)->sole();
    expect($event->actor_id)->toBe($moderator->id)
        ->and($event->reason)->toBe('rejected')
        ->and($event->changes['rejection_reason'])->toBe([null, 'Dados não conferem.']);
});

it('desfaz a decisão quando o registro de auditoria falha', function () {
    $moderator = Moderator::factory()->create();
    $approve = DriverSubmission::factory()->create();
    $reject = DriverSubmission::factory()->create();
    $this->mock(AuditLogger::class, function ($mock) {
        $mock->shouldReceive('driverLabel')->andReturn('x');
        $mock->shouldReceive('record')->andThrow(new RuntimeException('fora do ar'));
    });

    expect(fn () => app(DriverSubmissionService::class)->approve($approve, $moderator))->toThrow(RuntimeException::class)
        ->and(fn () => app(DriverSubmissionService::class)->reject($reject, $moderator, 'Motivo'))->toThrow(RuntimeException::class);

    expect($approve->fresh()->status->value)->toBe('pending')
        ->and($reject->fresh()->status->value)->toBe('pending')
        ->and(Driver::count())->toBe(0);
});

it('salvar a revisão grava submission_edited só com o que mudou', function () {
    $moderator = signInModerator();
    $submission = DriverSubmission::factory()->create(['qts' => 0.4]);

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getRouteKey()])
        ->fillForm(['qts' => 0.55])
        ->call('save')
        ->assertHasNoFormErrors();

    $event = AuditEvent::where('type', AuditType::SubmissionEdited)->sole();
    expect($event->actor_id)->toBe($moderator->id)
        ->and($event->changes)->toBe(['qts' => [0.4, 0.55]]);
});

it('salvar a revisão sem mudar nada não grava evento', function () {
    signInModerator();
    $submission = DriverSubmission::factory()->create();

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getRouteKey()])
        ->call('save')
        ->assertHasNoFormErrors();

    expect(AuditEvent::where('type', AuditType::SubmissionEdited)->count())->toBe(0);
});

it('aprovar pela tela de revisão grava a edição e a decisão', function () {
    signInModerator();
    $submission = DriverSubmission::factory()->create(['qts' => 0.4]);

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getRouteKey()])
        ->fillForm(['qts' => 0.5])
        ->callAction('approve');

    expect(AuditEvent::pluck('type')->map->value->sort()->values()->all())
        ->toBe(['driver_created', 'submission_approved', 'submission_edited']);
});

it('reenviar o aviso não gera evento', function () {
    $moderator = signInModerator();
    $submission = DriverSubmission::factory()->approved()->create(['contact_email' => 'a@b.co', 'decided_by' => $moderator->id]);
    AuditEvent::query()->delete();

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getRouteKey()])
        ->callAction('resendNotice');

    expect(AuditEvent::count())->toBe(0);
});
