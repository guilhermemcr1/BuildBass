<?php

use App\Enums\SubmissionStatus;
use App\Exceptions\AlreadyDecidedException;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Services\DriverSubmissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

it('rejeita com motivo, registra quem e quando e não cria driver', function () {
    $moderator = Moderator::factory()->create();
    $submission = DriverSubmission::factory()->create(['brand' => 'Exemplo', 'model' => 'EX-1']);

    app(DriverSubmissionService::class)->reject($submission, $moderator, 'Os dados não conferem com a ficha.');

    $fresh = $submission->fresh();
    expect($fresh->status)->toBe(SubmissionStatus::Rejected)
        ->and($fresh->rejection_reason)->toBe('Os dados não conferem com a ficha.')
        ->and($fresh->decided_by)->toBe($moderator->id)
        ->and($fresh->decided_at)->not->toBeNull()
        ->and($fresh->driver_id)->toBeNull()
        ->and(Driver::count())->toBe(0);

    $this->getJson('/api/drivers?q=exemplo')->assertOk()->assertJsonCount(0, 'data');
});

it('exige motivo de 1 a 500 caracteres', function (string $reason) {
    $submission = DriverSubmission::factory()->create();

    expect(fn () => app(DriverSubmissionService::class)->reject($submission, Moderator::factory()->create(), $reason))
        ->toThrow(ValidationException::class);

    expect($submission->fresh()->status)->toBe(SubmissionStatus::Pending);
})->with(['vazio' => '', 'só espaços' => '   ', 'só marcação' => '<b></b>', 'longo demais' => str_repeat('a', 501)]);

it('aceita motivo com 500 caracteres', function () {
    $submission = DriverSubmission::factory()->create();

    app(DriverSubmissionService::class)->reject($submission, Moderator::factory()->create(), str_repeat('a', 500));

    expect($submission->fresh()->status)->toBe(SubmissionStatus::Rejected);
});

it('o motivo vira texto puro', function () {
    $submission = DriverSubmission::factory()->create();

    app(DriverSubmissionService::class)->reject($submission, Moderator::factory()->create(), '<script>x</script>Dados  errados');

    expect($submission->fresh()->rejection_reason)->toBe('xDados errados');
});

it('rejeitar de novo não muda nada', function () {
    $moderator = Moderator::factory()->create();
    $submission = DriverSubmission::factory()->create();
    app(DriverSubmissionService::class)->reject($submission, $moderator, 'Primeiro motivo');

    expect(fn () => app(DriverSubmissionService::class)->reject($submission, $moderator, 'Segundo motivo'))
        ->toThrow(AlreadyDecidedException::class);

    expect($submission->fresh()->rejection_reason)->toBe('Primeiro motivo');
});
