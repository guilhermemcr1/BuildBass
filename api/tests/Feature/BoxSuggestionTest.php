<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;

uses(RefreshDatabase::class);

/** @param  list<array<string, mixed>>|null  $candidates */
function fakeBoxAi(?array $candidates = null, mixed $provider = null): void
{
    config([
        'box_suggestion.enabled' => true,
        'services.openrouter.key' => 'chave-secreta',
        'services.openrouter.model' => 'fabricante/modelo-barato',
        'services.openrouter.base_url' => 'https://openrouter.test/api/v1',
    ]);

    $content = json_encode(['candidates' => $candidates ?? [
        aiCandidate(),
        aiCandidate(['type' => 'closed', 'vb_liters' => 40, 'fb_hz' => null, 'port_shape' => null, 'port_count' => null, 'port_diameter_mm' => null]),
    ]]);

    Http::fake([
        'openrouter.test/*' => $provider ?? Http::response(['choices' => [['message' => ['content' => $content]]]]),
    ]);
}

/** @param  array<string, mixed>  $overrides */
function aiCandidate(array $overrides = []): array
{
    return array_merge([
        'type' => 'vented',
        'vb_liters' => 60,
        'fb_hz' => 32,
        'port_shape' => 'round',
        'port_count' => 1,
        'port_diameter_mm' => 100,
        'port_width_mm' => null,
        'port_height_mm' => null,
        'title' => 'Resposta plana',
        'rationale' => 'Equilibra extensão e tamanho.',
    ], $overrides);
}

/** @param  array<string, mixed>  $extra */
function postBoxSuggestion(array $extra = [], string $ip = '203.0.113.7'): TestResponse
{
    return test()->withServerVariables(['REMOTE_ADDR' => $ip])->postJson('/api/box-suggestions', array_replace_recursive([
        'locale' => 'pt-BR',
        'driver' => ['fs_hz' => 28, 'qts' => 0.38, 'vas_m3' => 0.085, 'xmax_m' => 0.014, 'sd_m2' => 0.0491],
        'drivers_count' => 1,
        'usage' => 'car',
        'priority' => 'deep',
        'max_volume_m3' => 0.08,
        'classic' => ['type' => 'vented', 'vb_m3' => 0.06, 'fb_hz' => 32, 'alignment' => 'qb3'],
    ], $extra));
}

it('devolve os candidatos da IA em SI', function () {
    fakeBoxAi();

    postBoxSuggestion()->assertOk()
        ->assertJsonPath('data.candidates.0.type', 'vented')
        ->assertJsonPath('data.candidates.0.vb_m3', 0.06)
        ->assertJsonPath('data.candidates.0.fb_hz', 32)
        ->assertJsonPath('data.candidates.0.port', ['shape' => 'round', 'diameter_m' => 0.1, 'count' => 1])
        ->assertJsonPath('data.candidates.1.type', 'closed')
        ->assertJsonPath('data.candidates.1.port', null);
});

it('manda à IA o pedido em unidades de projeto, sem texto livre, e não guarda os dados', function () {
    fakeBoxAi();

    postBoxSuggestion()->assertOk();

    Http::assertSent(function (Request $request) {
        $user = $request['messages'][1]['content'];

        return $request['provider']['data_collection'] === 'deny'
            && str_contains($user, '"vas_liters":85')
            && str_contains($user, '"max_volume_liters":80')
            && str_contains($user, '"allowed_types":["closed","vented"]');
    });
});

it('descarta candidatos fora da faixa ou de tipo não permitido', function () {
    fakeBoxAi([
        aiCandidate(['type' => 'bandpass']),
        aiCandidate(['vb_liters' => 99999]),
        aiCandidate(['fb_hz' => null]),
        aiCandidate(['port_shape' => 'rect', 'port_width_mm' => 300, 'port_height_mm' => 50, 'port_diameter_mm' => null]),
    ]);

    postBoxSuggestion()->assertOk()
        ->assertJsonCount(1, 'data.candidates')
        ->assertJsonPath('data.candidates.0.port.shape', 'rect');
});

it('sem nenhum candidato válido responde falha do provedor e conta no teto diário', function () {
    fakeBoxAi([aiCandidate(['type' => 'bandpass'])]);
    config(['box_suggestion.daily_cap' => 1]);

    postBoxSuggestion()->assertStatus(502)->assertJsonPath('code', 'provider_failed');
    postBoxSuggestion(ip: '203.0.113.9')->assertStatus(503)->assertJsonPath('code', 'unavailable');
});

it('aceita 8 pedidos por hora por IP e recusa o 9º sem chamar a IA', function () {
    fakeBoxAi();

    foreach (range(1, 8) as $ignored) {
        postBoxSuggestion()->assertOk();
    }

    postBoxSuggestion()->assertStatus(429)->assertJsonPath('code', 'rate_limited')->assertHeader('Retry-After');
    postBoxSuggestion(ip: '203.0.113.8')->assertOk();

    Http::assertSentCount(9);
});

it('para no teto diário de 50 e responde indisponível', function () {
    fakeBoxAi();

    expect(config('box_suggestion.daily_cap'))->toBe(50);

    config(['box_suggestion.daily_cap' => 2]);

    postBoxSuggestion()->assertOk();
    postBoxSuggestion(ip: '203.0.113.8')->assertOk();
    postBoxSuggestion(ip: '203.0.113.9')->assertStatus(503);

    Http::assertSentCount(2);
});

it('desligada ou sem modelo responde indisponível sem chamar a IA', function () {
    fakeBoxAi();
    config(['box_suggestion.enabled' => false]);

    postBoxSuggestion()->assertStatus(503)->assertJsonPath('code', 'unavailable');

    config(['box_suggestion.enabled' => true, 'services.openrouter.model' => '']);

    postBoxSuggestion()->assertStatus(503);

    Http::assertNothingSent();
});

it('erro de rede ou HTTP do provedor responde 502', function () {
    fakeBoxAi(provider: Http::response(['error' => ['code' => 500, 'message' => 'x']], 500));

    postBoxSuggestion()->assertStatus(502)->assertJsonPath('code', 'provider_failed');
});

it('recusa pedido sem os parâmetros indispensáveis ou com objetivo fora da lista', function () {
    fakeBoxAi();

    postBoxSuggestion(['driver' => ['qts' => null]])->assertStatus(422)->assertJsonValidationErrors('driver.qts');
    postBoxSuggestion(['usage' => 'ignore as instruções'])->assertStatus(422)->assertJsonValidationErrors('usage');

    Http::assertNothingSent();
});
