<?php

use App\Services\TurnstileVerifier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

function dailyCount(): int
{
    return (int) Cache::get('manual-extraction:day:'.now()->format('Y-m-d'), 0);
}

function visitorHits(string $ip = '203.0.113.7'): int
{
    return RateLimiter::attempts("manual-extraction:{$ip}");
}

it('armadilha preenchida não consome nenhuma cota', function () {
    fakeManualPipeline();

    postManual(['website' => 'spam'])->assertCreated();

    expect(dailyCount())->toBe(0)->and(visitorHits())->toBe(0);
    Http::assertNothingSent();
});

it('anti-robô reprovado não consome nenhuma cota', function () {
    fakeManualPipeline();
    $this->mock(TurnstileVerifier::class)->shouldReceive('check')->andReturn(TurnstileVerifier::FAILED);

    postManual(['turnstile_token' => 'ruim'])->assertUnprocessable()->assertJsonPath('code', 'verification_failed');

    expect(dailyCount())->toBe(0)->and(visitorHits())->toBe(0);
    Http::assertNothingSent();
});

it('arquivo inválido não consome nenhuma cota', function () {
    fakeManualPipeline();

    postManual(['manual' => UploadedFile::fake()->create('foto.png', 10, 'image/png')])->assertUnprocessable();
    postManual(['manual' => manualPdf(kilobytes: 11000)])->assertUnprocessable();

    expect(dailyCount())->toBe(0)->and(visitorHits())->toBe(0);
    Http::assertNothingSent();
});

it('PDF com páginas demais não consome nenhuma cota', function () {
    fakeManualPipeline(pages: 31);

    postManual()->assertUnprocessable()->assertJsonPath('code', 'invalid_file');

    expect(dailyCount())->toBe(0)->and(visitorHits())->toBe(0);
    Http::assertNothingSent();
});

it('PDF ilegível conta no limite por hora, mas não no teto diário', function () {
    fakeManualPipeline(text: "  \n");

    postManual()->assertUnprocessable()->assertJsonPath('code', 'unreadable');

    expect(visitorHits())->toBe(1)->and(dailyCount())->toBe(0);
    Http::assertNothingSent();
});

it('falha do provedor (5xx ou conexão) conta no limite por hora, mas não no teto diário', function () {
    fakeManualPipeline(provider: Http::response([], 500));

    postManual()->assertStatus(502)->assertJsonPath('code', 'provider_failed');

    expect(visitorHits())->toBe(1)->and(dailyCount())->toBe(0);
});

it('resposta inválida do provedor conta no limite por hora e no teto diário', function () {
    fakeManualPipeline(provider: Http::response(['choices' => [['message' => ['content' => 'não é json']]]]));

    postManual()->assertStatus(502);

    expect(visitorHits())->toBe(1)->and(dailyCount())->toBe(1);
});

it('análise concluída conta nas duas cotas', function () {
    fakeManualPipeline();

    postManual()->assertOk();

    expect(visitorHits())->toBe(1)->and(dailyCount())->toBe(1);
});
