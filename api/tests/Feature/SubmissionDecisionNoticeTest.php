<?php

use App\Enums\SubmissionStatus;
use App\Mail\SubmissionDecided;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Models\Moderator;
use App\Services\DriverSubmissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

function decide(): DriverSubmissionService
{
    return app(DriverSubmissionService::class);
}

it('aprovar com e-mail avisa o remetente no idioma do envio e apaga o e-mail', function (string $locale, string $subject) {
    Mail::fake();
    $submission = DriverSubmission::factory()->create([
        'contact_email' => 'pessoa@exemplo.com',
        'locale' => $locale,
        'brand' => 'Exemplo',
        'model' => 'EX-1',
    ]);

    decide()->approve($submission, Moderator::factory()->create());

    Mail::assertSent(SubmissionDecided::class, function (SubmissionDecided $mail) use ($subject, $locale) {
        // O Mailer troca o locale só durante o envio; aqui o troca à mão para ler o assunto.
        app()->setLocale((string) $mail->locale);

        return $mail->hasTo('pessoa@exemplo.com')
            && $mail->hasSubject($subject)
            && $mail->locale === ($locale === 'en' ? 'en' : 'pt_BR');
    });
    expect($submission->fresh()->contact_email)->toBeNull()
        ->and($submission->fresh()->status)->toBe(SubmissionStatus::Approved);
})->with([
    ['pt-BR', 'Seu driver foi aprovado'],
    ['en', 'Your driver was approved'],
]);

it('rejeitar com e-mail envia o motivo e apaga o e-mail', function () {
    Mail::fake();
    $submission = DriverSubmission::factory()->create(['contact_email' => 'pessoa@exemplo.com']);

    decide()->reject($submission, Moderator::factory()->create(), 'Os valores não conferem com a ficha.');

    Mail::assertSent(SubmissionDecided::class, function (SubmissionDecided $mail) {
        return $mail->hasTo('pessoa@exemplo.com')
            && str_contains($mail->render(), 'Os valores não conferem com a ficha.')
            && str_contains($mail->render(), $mail->submission->id);
    });
    expect($submission->fresh()->contact_email)->toBeNull();
});

it('o aviso sai no idioma do envio (en) com o motivo', function () {
    $submission = DriverSubmission::factory()->rejected()->create([
        'locale' => 'en',
        'contact_email' => 'a@b.com',
        'rejection_reason' => 'Values do not match.',
    ]);

    $html = (new SubmissionDecided($submission))->render();

    expect($html)->toContain('Driver not approved')
        ->toContain('Values do not match.')
        ->not->toContain('Motivo');
});

it('o texto do remetente vai escapado no aviso', function () {
    $submission = DriverSubmission::factory()->rejected()->create([
        'contact_email' => 'a@b.com',
        'brand' => '<script>alert(1)</script>',
        'rejection_reason' => '<img src=x onerror=alert(1)>',
    ]);

    $html = (new SubmissionDecided($submission))->render();

    expect($html)->not->toContain('<script>alert(1)</script>')
        ->not->toContain('<img src=x');
});

it('sem e-mail nada é enviado', function () {
    Mail::fake();
    $submission = DriverSubmission::factory()->create(['contact_email' => null]);

    decide()->approve($submission, Moderator::factory()->create());

    Mail::assertNothingSent();
});

it('falha no envio não desfaz a decisão e mantém o e-mail para nova tentativa', function () {
    $submission = DriverSubmission::factory()->create(['contact_email' => 'pessoa@exemplo.com']);
    Mail::shouldReceive('to')->andThrow(new RuntimeException('SMTP fora do ar'));

    $driver = decide()->approve($submission, Moderator::factory()->create());

    $fresh = $submission->fresh();
    expect($fresh->status)->toBe(SubmissionStatus::Approved)
        ->and($fresh->driver_id)->toBe($driver->id)
        ->and($fresh->contact_email)->toBe('pessoa@exemplo.com')
        ->and(Driver::count())->toBe(1);
});

it('falha no envio da rejeição também mantém a decisão', function () {
    $submission = DriverSubmission::factory()->create(['contact_email' => 'pessoa@exemplo.com']);
    Mail::shouldReceive('to')->andThrow(new RuntimeException('SMTP fora do ar'));

    decide()->reject($submission, Moderator::factory()->create(), 'Motivo.');

    expect($submission->fresh()->status)->toBe(SubmissionStatus::Rejected)
        ->and($submission->fresh()->contact_email)->toBe('pessoa@exemplo.com');
});

it('o e-mail do remetente não aparece em nenhuma resposta pública', function () {
    $this->postJson('/api/driver-submissions', [
        'brand' => 'Marca', 'model' => 'M-1', 'source' => 'Ficha',
        'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.05, 'contact_email' => 'pessoa@exemplo.com',
    ])->assertCreated();

    $this->getJson('/api/drivers?q=marca')->assertOk();
    $this->assertStringNotContainsString('pessoa@exemplo.com', $this->getJson('/api/drivers?q=marca')->getContent());
});
