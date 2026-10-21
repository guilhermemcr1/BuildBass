<?php

use App\Filament\Resources\DriverSubmissions\Pages\EditDriverSubmission;
use App\Mail\SubmissionDecided;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Livewire\Livewire;

uses(RefreshDatabase::class);

beforeEach(function () {
    Filament::setCurrentPanel('moderation');
    test()->actingAs(Moderator::factory()->create(), 'moderator');
});

it('reenvia o aviso de um envio decidido que ainda guarda o e-mail e apaga o e-mail', function () {
    Mail::fake();
    $submission = DriverSubmission::factory()->rejected()->create(['contact_email' => 'pessoa@exemplo.com']);

    Livewire::test(EditDriverSubmission::class, ['record' => $submission->getKey()])
        ->callAction('resendNotice')
        ->assertNotified();

    Mail::assertSent(SubmissionDecided::class);
    expect($submission->fresh()->contact_email)->toBeNull();
});

it('a ação não existe para pendentes nem para quem não tem e-mail guardado', function () {
    $pending = DriverSubmission::factory()->create(['contact_email' => 'pessoa@exemplo.com']);
    $noEmail = DriverSubmission::factory()->rejected()->create(['contact_email' => null]);

    Livewire::test(EditDriverSubmission::class, ['record' => $pending->getKey()])
        ->assertActionHidden('resendNotice');
    Livewire::test(EditDriverSubmission::class, ['record' => $noEmail->getKey()])
        ->assertActionHidden('resendNotice');
});

it('o painel não mostra o e-mail do remetente', function () {
    $submission = DriverSubmission::factory()->rejected()->create(['contact_email' => 'pessoa@exemplo.com']);

    $html = Livewire::test(EditDriverSubmission::class, ['record' => $submission->getKey()])->html();

    expect($html)->not->toContain('pessoa@exemplo.com');
});
