<?php

use App\Enums\SubmissionStatus;
use App\Filament\Resources\DriverSubmissions\Pages\EditDriverSubmission;
use App\Filament\Resources\DriverSubmissions\Pages\ListDriverSubmissions;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Models\User;
use App\Services\DriverSubmissionService;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;

uses(RefreshDatabase::class);

beforeEach(function () {
    Filament::setCurrentPanel('moderation');
});

function signIn(): Moderator
{
    $moderator = Moderator::factory()->create();
    test()->actingAs($moderator, 'moderator');

    return $moderator;
}

it('manda o visitante sem sessão para o login do painel', function () {
    $this->get('/moderation')->assertRedirect('/moderation/login');
    $this->get('/moderation/envios')->assertRedirect('/moderation/login');
});

it('não deixa o guard de usuário comum entrar no painel', function () {
    $this->actingAs(User::factory()->create(), 'web')
        ->get('/moderation/envios')
        ->assertRedirect('/moderation/login');
});

it('o moderador autenticado abre a lista de envios', function () {
    signIn();

    $this->get('/moderation/envios')->assertOk();
});

it('lista os pendentes do mais antigo ao mais novo por padrão', function () {
    signIn();
    $newer = DriverSubmission::factory()->create(['created_at' => now()->subHour()]);
    $older = DriverSubmission::factory()->create(['created_at' => now()->subDay()]);
    DriverSubmission::factory()->approved()->create();

    Livewire::test(ListDriverSubmissions::class)
        ->assertCanSeeTableRecords([$older, $newer], inOrder: true)
        ->assertCountTableRecords(2);
});

it('filtra por situação', function () {
    signIn();
    $pending = DriverSubmission::factory()->create();
    $rejected = DriverSubmission::factory()->rejected()->create();

    Livewire::test(ListDriverSubmissions::class)
        ->filterTable('status', SubmissionStatus::Rejected->value)
        ->assertCanSeeTableRecords([$rejected])
        ->assertCanNotSeeTableRecords([$pending]);
});

it('destaca duplicata do catálogo, de outro envio e repetição do remetente', function () {
    signIn();
    Driver::factory()->create(['brand' => 'Exemplo', 'model' => 'EX-1', 'variant' => '']);
    $submission = DriverSubmission::factory()->create(['brand' => 'Exemplo', 'model' => 'EX-1', 'ip_hash' => str_repeat('a', 64)]);
    DriverSubmission::factory()->create(['brand' => 'EXEMPLO', 'model' => 'ex-1', 'ip_hash' => str_repeat('a', 64)]);

    $alerts = app(DriverSubmissionService::class)->alertsFor($submission);

    expect($alerts)->toContain('Possível duplicata do catálogo')
        ->toContain('Possível duplicata de outro envio')
        ->toContain('2 envios do mesmo remetente');
});

it('não lista e-mail do remetente nem o hash inteiro', function () {
    signIn();
    $submission = DriverSubmission::factory()->create(['contact_email' => 'pessoa@exemplo.com']);

    $html = Livewire::test(ListDriverSubmissions::class)->html();

    expect($html)->not->toContain('pessoa@exemplo.com')
        ->not->toContain($submission->ip_hash);
});

it('aprova pela tela: salva as edições, cria o driver e decide', function () {
    $moderator = signIn();
    $submission = DriverSubmission::factory()->create(['qts' => 0.4, 'model' => 'EX-1']);

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getKey()])
        ->fillForm(['qts' => 0.43])
        ->callAction('approve')
        ->assertHasNoActionErrors();

    $submission->refresh();
    expect($submission->status)->toBe(SubmissionStatus::Approved)
        ->and($submission->decided_by)->toBe($moderator->id)
        ->and(Driver::query()->firstOrFail()->qts)->toBe(0.43);
});

it('aprovar com colisão mostra erro e não muda nada', function () {
    signIn();
    Driver::factory()->create(['brand' => 'Exemplo', 'model' => 'EX-1', 'variant' => '']);
    $submission = DriverSubmission::factory()->create(['brand' => 'Exemplo', 'model' => 'EX-1']);

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getKey()])
        ->callAction('approve')
        ->assertNotified();

    expect($submission->fresh()->status)->toBe(SubmissionStatus::Pending)
        ->and(Driver::count())->toBe(1);
});

it('rejeitar sem motivo falha na validação e com motivo decide', function () {
    signIn();
    $submission = DriverSubmission::factory()->create();

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getKey()])
        ->callAction('reject', ['reason' => ''])
        ->assertHasActionErrors(['reason' => 'required']);

    expect($submission->fresh()->status)->toBe(SubmissionStatus::Pending);

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getKey()])
        ->callAction('reject', ['reason' => 'Não confere com a ficha.'])
        ->assertHasNoActionErrors();

    expect($submission->fresh()->status)->toBe(SubmissionStatus::Rejected)
        ->and($submission->fresh()->rejection_reason)->toBe('Não confere com a ficha.');
});

it('esconde aprovar e rejeitar para envios já decididos', function () {
    signIn();
    $submission = DriverSubmission::factory()->rejected()->create();

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getKey()])
        ->assertActionHidden('approve')
        ->assertActionHidden('reject');
});

it('mostra o texto do remetente escapado', function () {
    signIn();
    $submission = DriverSubmission::factory()->create(['source' => '"><img src=x onerror=alert(1)>']);

    $html = Livewire::test(EditDriverSubmission::class, ['record' => $submission->getKey()])->html();

    expect($html)->not->toContain('<img src=x onerror');
});
