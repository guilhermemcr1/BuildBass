<?php

use App\Exceptions\Manual\ManualProviderException;
use App\Services\Manual\ManualAiClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config([
        'services.openrouter.key' => 'chave-secreta',
        'services.openrouter.model' => 'fabricante/modelo-barato',
        'services.openrouter.base_url' => 'https://openrouter.test/api/v1',
    ]);
});

function aiBody(array $content): array
{
    return ['choices' => [['message' => ['content' => json_encode($content)]]]];
}

function aiDriver(array $overrides = []): array
{
    return array_merge([
        'brand' => 'Triton',
        'model' => 'TR 620',
        'variant' => null,
        'type' => 'woofer',
        'fs' => ['value' => 76.94, 'unit' => 'Hz'],
        'qts' => ['value' => 0.717, 'unit' => 'none'],
        'vas' => ['value' => 26.348, 'unit' => 'L'],
    ], $overrides);
}

it('chama o OpenRouter com saída estruturada estrita e sem retenção de dados', function () {
    // O .env local pode liberar a coleta (modelos gratuitos); o padrão do sistema é negar.
    config(['services.openrouter.data_collection' => 'deny']);
    Http::fake(['openrouter.test/*' => Http::response(aiBody(['drivers' => [aiDriver()]]))]);

    $drivers = (new ManualAiClient)->read("Qts 0,717 | Fs 76,94 Hz\n");

    Http::assertSentCount(1);
    Http::assertSent(function (Request $request) {
        $body = $request->data();
        $driver = $body['response_format']['json_schema']['schema']['properties']['drivers']['items'];

        return $request->url() === 'https://openrouter.test/api/v1/chat/completions'
            && $request->hasHeader('Authorization', 'Bearer chave-secreta')
            && $body['model'] === 'fabricante/modelo-barato'
            && $body['temperature'] === 0
            && $body['response_format']['type'] === 'json_schema'
            && $body['response_format']['json_schema']['strict'] === true
            && $body['provider'] === ['require_parameters' => true, 'data_collection' => 'deny']
            && str_contains(json_encode($body['messages']), '<manual>')
            && str_contains(json_encode($body['messages']), 'Qts 0,717')
            && $driver['additionalProperties'] === false
            && $driver['properties']['vas']['properties']['unit']['enum'] === ['m3', 'L', 'cm3', 'ft3', 'in3', null];
    });

    expect($drivers)->toHaveCount(1)
        ->and($drivers[0]['model'])->toBe('TR 620')
        ->and($drivers[0]['values']['vas_m3'])->toBe(['value' => 26.348, 'unit' => 'L'])
        ->and($drivers[0]['values']['qes'])->toBe(['value' => null, 'unit' => null]);
});

it('limita a resposta a 5 drivers', function () {
    Http::fake(['openrouter.test/*' => Http::response(aiBody(['drivers' => array_fill(0, 8, aiDriver())]))]);

    expect((new ManualAiClient)->read('texto'))->toHaveCount(5);
});

it('falha sem retry quando o provedor responde erro', function () {
    Http::fake(['openrouter.test/*' => Http::response(['error' => 'x'], 500)]);

    try {
        (new ManualAiClient)->read('texto');
    } catch (ManualProviderException $exception) {
        expect($exception->responded)->toBeFalse();
    }

    Http::assertSentCount(1);
    expect(isset($exception))->toBeTrue();
});

it('falha sem resposta quando a conexão cai', function () {
    Http::fake(['openrouter.test/*' => fn () => throw new ConnectionException('timeout')]);

    try {
        (new ManualAiClient)->read('texto');
    } catch (ManualProviderException $exception) {
        expect($exception->responded)->toBeFalse();
    }

    expect(isset($exception))->toBeTrue();
});

it('conta como resposta do provedor quando o conteúdo vem fora do schema', function (array $body) {
    Http::fake(['openrouter.test/*' => Http::response($body)]);

    try {
        (new ManualAiClient)->read('texto');
    } catch (ManualProviderException $exception) {
        expect($exception->responded)->toBeTrue();
    }

    expect(isset($exception))->toBeTrue();
})->with([
    'sem choices' => [['id' => 'x']],
    'conteúdo não é JSON' => [['choices' => [['message' => ['content' => 'não sou json']]]]],
    'drivers não é lista' => [aiBody(['drivers' => 'nada'])],
    'valor não numérico' => [aiBody(['drivers' => [aiDriver(['fs' => ['value' => 'alto', 'unit' => 'Hz']])]])],
    'texto não é string' => [aiBody(['drivers' => [aiDriver(['brand' => ['x']])]])],
]);

it('aceita lista vazia de drivers', function () {
    Http::fake(['openrouter.test/*' => Http::response(aiBody(['drivers' => []]))]);

    expect((new ManualAiClient)->read('texto'))->toBe([]);
});

it('permite coleta de dados só quando a configuração pede (modelos gratuitos)', function () {
    fakeManualPipeline();
    config(['services.openrouter.data_collection' => 'allow']);

    (new ManualAiClient)->read('Fs 40 Hz');

    Http::assertSent(fn ($request) => $request['provider'] === ['require_parameters' => true, 'data_collection' => 'allow']);
});
