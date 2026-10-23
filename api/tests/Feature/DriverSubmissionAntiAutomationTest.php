<?php

use App\Models\DriverSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

function human(array $overrides = []): array
{
    return array_merge([
        'brand' => 'Marca',
        'model' => 'M-1',
        'source' => 'Ficha',
        'contact_email' => 'pessoa@exemplo.com',
        'fs_hz' => 40,
        'qts' => 0.4,
        'vas_m3' => 0.05,
    ], $overrides);
}

it('campo-armadilha preenchido responde como sucesso, mas não grava nada', function () {
    $response = $this->postJson('/api/driver-submissions', human(['website' => 'http://spam.example']))
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending');

    $protocol = $response->json('data.protocol');

    expect($protocol)->toMatch('/^[0-9a-f-]{36}$/')
        ->and(DriverSubmission::count())->toBe(0)
        ->and(DriverSubmission::find($protocol))->toBeNull();
});

it('a armadilha vale mesmo com o corpo inválido e não cita a regra', function () {
    $response = $this->postJson('/api/driver-submissions', ['website' => 'x']);

    $response->assertCreated();
    expect(strtolower($response->getContent()))->not->toContain('honeypot')->not->toContain('website');
});

it('com a verificação ligada recusa token ausente, reprovado e rede fora do ar', function (string $case) {
    config(['services.turnstile.enabled' => true, 'services.turnstile.secret' => 'segredo']);

    match ($case) {
        'ausente' => Http::fake(),
        'reprovado' => Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => false])]),
        'erro' => Http::fake(['challenges.cloudflare.com/*' => Http::response('x', 500)]),
        'rede' => Http::fake(['challenges.cloudflare.com/*' => fn () => throw new RuntimeException('sem rede')]),
    };

    $payload = human($case === 'ausente' ? [] : ['turnstile_token' => 'tok']);

    $this->postJson('/api/driver-submissions', $payload)
        ->assertUnprocessable()
        ->assertJsonPath('code', 'verification_failed')
        ->assertJsonMissingPath('errors');

    expect(DriverSubmission::count())->toBe(0);
})->with(['ausente', 'reprovado', 'erro', 'rede']);

it('com a verificação ligada aceita token aprovado e não repassa o IP', function () {
    config(['services.turnstile.enabled' => true, 'services.turnstile.secret' => 'segredo']);
    Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => true])]);

    $this->postJson('/api/driver-submissions', human(['turnstile_token' => 'tok']))->assertCreated();

    Http::assertSent(fn ($request) => $request->url() === 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
        && $request['secret'] === 'segredo'
        && $request['response'] === 'tok'
        && ! isset($request['remoteip']));
    expect(DriverSubmission::count())->toBe(1);
});

it('a mesma mensagem para qualquer causa de reprovação', function () {
    config(['services.turnstile.enabled' => true, 'services.turnstile.secret' => 'segredo']);
    Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => false])]);

    $reprovado = $this->postJson('/api/driver-submissions', human(['turnstile_token' => 'tok']))->json();
    $ausente = $this->postJson('/api/driver-submissions', human())->json();

    expect($reprovado)->toBe($ausente);
});
