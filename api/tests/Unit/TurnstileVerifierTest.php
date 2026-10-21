<?php

use App\Services\TurnstileVerifier;
use Illuminate\Support\Facades\Http;

it('desligado, aprova sem chamar a rede', function () {
    config(['services.turnstile.enabled' => false]);
    Http::fake();

    expect((new TurnstileVerifier)->verify(null))->toBeTrue()
        ->and((new TurnstileVerifier)->verify('qualquer'))->toBeTrue();

    Http::assertNothingSent();
});

it('ligado, chama o siteverify com o segredo e o token', function () {
    config(['services.turnstile.enabled' => true, 'services.turnstile.secret' => 's3gredo']);
    Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => true])]);

    expect((new TurnstileVerifier)->verify('tok'))->toBeTrue();

    Http::assertSent(fn ($request) => $request->method() === 'POST'
        && $request['secret'] === 's3gredo'
        && $request['response'] === 'tok');
});

it('ligado, success false ou exceção reprovam', function () {
    config(['services.turnstile.enabled' => true, 'services.turnstile.secret' => 's3gredo']);

    Http::fake(['challenges.cloudflare.com/*' => Http::response(['success' => false])]);
    expect((new TurnstileVerifier)->verify('tok'))->toBeFalse();

    Http::fake(['challenges.cloudflare.com/*' => fn () => throw new RuntimeException('sem rede')]);
    expect((new TurnstileVerifier)->verify('tok'))->toBeFalse();
});

it('ligado, sem token reprova sem chamar a rede', function () {
    config(['services.turnstile.enabled' => true]);
    Http::fake();

    expect((new TurnstileVerifier)->verify(null))->toBeFalse()
        ->and((new TurnstileVerifier)->verify(''))->toBeFalse();

    Http::assertNothingSent();
});
