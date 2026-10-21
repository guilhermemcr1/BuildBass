<?php

use App\Enums\SubmissionStatus;
use App\Exceptions\AlreadyDecidedException;
use App\Exceptions\DuplicateDriverException;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Services\DriverSubmissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function service(): DriverSubmissionService
{
    return app(DriverSubmissionService::class);
}

it('cria o driver no catálogo com os valores do envio e marca o envio como aprovado', function () {
    $moderator = Moderator::factory()->create();
    $submission = DriverSubmission::factory()->create([
        'brand' => 'Exemplo Áudio',
        'model' => 'EX-12',
        'variant' => '4 Ω',
        'fs_hz' => 34.5,
        'source' => 'Ficha técnica',
    ]);

    $driver = service()->approve($submission, $moderator);

    $submission->refresh();
    expect($driver->brand)->toBe('Exemplo Áudio')
        ->and($driver->model)->toBe('EX-12')
        ->and($driver->variant)->toBe('4 Ω')
        ->and($driver->fs_hz)->toBe(34.5)
        ->and($driver->source)->toBe('Ficha técnica')
        ->and($driver->search_text)->toBe('exemplo audio ex-12 4 o')
        ->and($submission->status)->toBe(SubmissionStatus::Approved)
        ->and($submission->decided_by)->toBe($moderator->id)
        ->and($submission->decided_at)->not->toBeNull()
        ->and($submission->driver_id)->toBe($driver->id)
        ->and($submission->rejection_reason)->toBeNull();
});

it('o driver aprovado passa a ser encontrado pela busca pública', function () {
    $submission = DriverSubmission::factory()->create(['brand' => 'Exemplo Áudio', 'model' => 'EX-12']);

    $this->getJson('/api/drivers?q=exemplo')->assertOk()->assertJsonCount(0, 'data');

    service()->approve($submission, Moderator::factory()->create());

    $this->getJson('/api/drivers?q=exemplo audio')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.model', 'EX-12');
});

it('aprova com os valores corrigidos pelo moderador', function () {
    $submission = DriverSubmission::factory()->create(['qts' => 0.4, 'model' => 'EX-12']);

    $submission->update(['qts' => 0.43, 'model' => 'EX-12B']);
    $driver = service()->approve($submission, Moderator::factory()->create());

    expect($driver->qts)->toBe(0.43)
        ->and($driver->model)->toBe('EX-12B');
});

it('recusa a aprovação quando o driver já existe e não muda nada', function () {
    Driver::factory()->create(['brand' => 'Exemplo', 'model' => 'EX-1', 'variant' => '']);
    $submission = DriverSubmission::factory()->create(['brand' => 'EXEMPLO', 'model' => 'ex-1', 'variant' => '']);

    expect(fn () => service()->approve($submission, Moderator::factory()->create()))
        ->toThrow(DuplicateDriverException::class);

    expect($submission->fresh()->status)->toBe(SubmissionStatus::Pending)
        ->and($submission->fresh()->driver_id)->toBeNull()
        ->and(Driver::count())->toBe(1);
});

it('recusa a aprovação quando a chave exata já existe no catálogo', function () {
    Driver::factory()->create(['brand' => 'Exemplo', 'model' => 'EX-1', 'variant' => '4 Ω']);
    $submission = DriverSubmission::factory()->create(['brand' => 'Exemplo', 'model' => 'EX-1', 'variant' => '4 Ω']);

    expect(fn () => service()->approve($submission, Moderator::factory()->create()))
        ->toThrow(DuplicateDriverException::class);

    expect(Driver::count())->toBe(1);
});

it('decide uma única vez: aprovar ou rejeitar de novo não muda nada', function () {
    $moderator = Moderator::factory()->create();
    $submission = DriverSubmission::factory()->create();
    service()->approve($submission, $moderator);
    $decidedAt = $submission->fresh()->decided_at;

    expect(fn () => service()->approve($submission, $moderator))->toThrow(AlreadyDecidedException::class)
        ->and(fn () => service()->reject($submission, $moderator, 'tarde demais'))
        ->toThrow(AlreadyDecidedException::class);

    $fresh = $submission->fresh();
    expect($fresh->status)->toBe(SubmissionStatus::Approved)
        ->and($fresh->decided_at->equalTo($decidedAt))->toBeTrue()
        ->and($fresh->rejection_reason)->toBeNull()
        ->and(Driver::count())->toBe(1);
});

it('não deixa driver órfão nem envio aprovado se a criação falhar no meio', function () {
    $submission = DriverSubmission::factory()->create();
    Driver::creating(fn () => throw new RuntimeException('falha simulada'));

    expect(fn () => service()->approve($submission, Moderator::factory()->create()))
        ->toThrow(RuntimeException::class);

    expect($submission->fresh()->status)->toBe(SubmissionStatus::Pending)
        ->and($submission->fresh()->driver_id)->toBeNull()
        ->and(Driver::count())->toBe(0);
});
