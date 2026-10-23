<?php

use App\Enums\AuditType;
use App\Models\AuditEvent;
use App\Models\DriverSubmission;
use App\Support\IpHash;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->withoutDefer();
});

function publicSubmission(array $overrides = []): array
{
    return array_merge([
        'brand' => 'Marca', 'model' => 'M-1', 'source' => 'Ficha', 'contact_email' => 'pessoa@exemplo.com',
        'fs_hz' => 40, 'qts' => 0.4, 'vas_m3' => 0.05, 'locale' => 'pt-BR',
    ], $overrides);
}

it('um envio recebido grava submission_received com o protocolo, sem e-mail nem IP em claro', function () {
    $response = $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
        ->postJson('/api/driver-submissions', publicSubmission())
        ->assertCreated();

    $event = AuditEvent::where('type', AuditType::SubmissionReceived)->sole();
    expect($event->subject_id)->toBe($response->json('data.protocol'))
        ->and($event->subject_type)->toBe('submission')
        ->and($event->ip_hash)->toBe(IpHash::make('203.0.113.7'))
        ->and(json_encode($event->getAttributes()))->not->toContain('pessoa@exemplo.com')->not->toContain('203.0.113.7');
});

it('envio recusado por duplicata ou validação não grava submission_received', function () {
    $this->postJson('/api/driver-submissions', ['brand' => ''])->assertUnprocessable();

    expect(AuditEvent::count())->toBe(0);
});

it('campo-armadilha grava bot_blocked honeypot e a resposta continua igual a um sucesso', function () {
    $this->postJson('/api/driver-submissions', publicSubmission(['website' => 'http://spam']))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending');

    $event = AuditEvent::sole();
    expect($event->type)->toBe(AuditType::BotBlocked)->and($event->reason)->toBe('honeypot')
        ->and(DriverSubmission::count())->toBe(0);
});

it('verificação anti-robô reprovada grava bot_blocked verification', function () {
    config(['services.turnstile.enabled' => true, 'services.turnstile.secret' => 'segredo']);
    Http::fake(['*' => Http::response(['success' => false])]);

    $this->postJson('/api/driver-submissions', publicSubmission(['turnstile_token' => 'ruim']))
        ->assertUnprocessable()
        ->assertJsonPath('code', 'verification_failed');

    $event = AuditEvent::where('type', AuditType::BotBlocked)->sole();
    expect($event->reason)->toBe('verification')->and($event->outcome)->toBe('blocked');
});

it('leitura de manual com sucesso grava manual_read ok contando para o teto diário', function () {
    fakeManualPipeline();

    postManual()->assertOk();

    $event = AuditEvent::sole();
    expect($event->type)->toBe(AuditType::ManualRead)
        ->and($event->outcome)->toBe('ok')
        ->and($event->quota_counted)->toBeTrue()
        ->and($event->ip_hash)->toBe(IpHash::make('203.0.113.7'));
});

it('provedor fora do ar grava manual_read failed sem contar para o teto diário', function () {
    fakeManualPipeline(provider: Http::response(['error' => 'x'], 500));

    postManual()->assertStatus(502);

    $event = AuditEvent::where('type', AuditType::ManualRead)->sole();
    expect($event->outcome)->toBe('failed')->and($event->reason)->toBe('provider_failed')->and($event->quota_counted)->toBeFalse();
});

it('resposta inválida do provedor grava manual_read failed contando para o teto diário', function () {
    // Um segundo Http::fake não sobrescreve o primeiro: por isso um teste por cenário.
    fakeManualPipeline(provider: Http::response(['choices' => [['message' => ['content' => 'não é json']]]]));

    postManual()->assertStatus(502);

    $event = AuditEvent::where('type', AuditType::ManualRead)->sole();
    expect($event->outcome)->toBe('failed')->and($event->quota_counted)->toBeTrue();
});

it('PDF ilegível grava manual_read failed sem o texto', function () {
    fakeManualPipeline(text: '12');

    postManual()->assertStatus(422);

    $event = AuditEvent::sole();
    expect($event->outcome)->toBe('failed')->and($event->reason)->toBe('unreadable')
        ->and(json_encode($event->getAttributes()))->not->toContain('ficha.pdf');
});

it('limite por hora grava manual_blocked hourly', function () {
    fakeManualPipeline();
    config(['manual_extraction.hourly_limit' => 1]);

    postManual()->assertOk();
    postManual()->assertStatus(429);

    $blocked = AuditEvent::where('type', AuditType::ManualBlocked)->sole();
    expect($blocked->reason)->toBe('hourly')->and($blocked->outcome)->toBe('blocked');
});

it('teto diário grava manual_blocked daily', function () {
    fakeManualPipeline();
    config(['manual_extraction.daily_cap' => 1, 'manual_extraction.hourly_limit' => 10]);

    postManual()->assertOk();
    postManual([], '203.0.113.8')->assertStatus(503);

    expect(AuditEvent::where('type', AuditType::ManualBlocked)->sole()->reason)->toBe('daily');
});

it('recurso desligado grava manual_blocked unavailable', function () {
    config(['manual_extraction.enabled' => false]);

    postManual()->assertStatus(503);

    expect(AuditEvent::sole()->reason)->toBe('unavailable');
});

it('PDF inválido (páginas demais) é falha de leitura, não bloqueio por cota', function () {
    fakeManualPipeline(pages: 99);

    postManual()->assertStatus(422);

    $event = AuditEvent::sole();
    expect($event->type)->toBe(AuditType::ManualRead)->and($event->outcome)->toBe('failed');
});

it('a falha ao gravar o evento não muda a resposta ao visitante', function () {
    // O logger real quebra por dentro (tabela ausente): a resposta ao visitante é a mesma.
    DB::statement('DROP TABLE audit_events');

    $this->postJson('/api/driver-submissions', publicSubmission())
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending');

    $this->postJson('/api/driver-submissions', publicSubmission(['website' => 'x']))->assertCreated();
});
