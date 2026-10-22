<?php

use App\Enums\SubmissionStatus;
use App\Models\Driver;
use App\Models\DriverSubmission;
use App\Support\IpHash;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function validSubmission(array $overrides = []): array
{
    return array_merge([
        'brand' => 'Exemplo Áudio',
        'model' => 'EX-12',
        'variant' => '4 Ω',
        'nominal_diameter_m' => 0.3048,
        'fs_hz' => 34.5,
        'qts' => 0.41,
        'vas_m3' => 0.085,
        'qes' => 0.45,
        'qms' => 5.2,
        're_ohm' => 3.4,
        'le_h' => 0.0009,
        'xmax_m' => 0.008,
        'sd_m2' => 0.0518,
        'pe_w' => 400,
        'bl_tm' => 12.1,
        'mms_kg' => 0.09,
        'vd_m3' => 0.000414,
        'source' => 'Ficha técnica do fabricante, rev. 2024',
        'locale' => 'pt-BR',
    ], $overrides);
}

it('recebe um envio válido e responde só com protocolo e situação', function () {
    $response = $this->postJson('/api/driver-submissions', validSubmission(['contact_email' => 'pessoa@exemplo.com']))
        ->assertCreated()
        ->assertExactJson(['data' => [
            'protocol' => DriverSubmission::first()->id,
            'status' => 'pending',
        ]]);

    expect($response->getContent())->not->toContain('pessoa@exemplo.com');
});

it('grava o envio pendente com o hash do IP e nunca com o IP em claro', function () {
    $this->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
        ->postJson('/api/driver-submissions', validSubmission(['contact_email' => 'pessoa@exemplo.com']))
        ->assertCreated();

    $submission = DriverSubmission::query()->firstOrFail();

    expect($submission->status)->toBe(SubmissionStatus::Pending)
        ->and($submission->ip_hash)->toBe(IpHash::make('203.0.113.7'))
        ->and($submission->dedupe_key)->toBe('exemplo audio ex-12 4 o')
        ->and($submission->contact_email)->toBe('pessoa@exemplo.com')
        ->and($submission->fs_hz)->toBe(34.5)
        ->and($submission->decided_at)->toBeNull()
        ->and($submission->driver_id)->toBeNull();

    $row = json_encode(DB::table('driver_submissions')->first());
    expect($row)->not->toContain('203.0.113.7');
});

it('aceita só os três parâmetros obrigatórios e deixa a variante vazia', function () {
    $this->postJson('/api/driver-submissions', [
        'brand' => 'Mínimo',
        'model' => 'M-1',
        'source' => 'Medição própria',
        'fs_hz' => 40,
        'qts' => 0.4,
        'vas_m3' => 0.05,
    ])->assertCreated();

    $submission = DriverSubmission::query()->firstOrFail();

    expect($submission->variant)->toBe('')
        ->and($submission->qes)->toBeNull()
        ->and($submission->locale)->toBe('pt-BR');
});

it('não deixa o envio pendente aparecer em nenhuma leitura do catálogo', function () {
    $this->postJson('/api/driver-submissions', validSubmission())->assertCreated();

    $this->getJson('/api/drivers?q=exemplo')->assertOk()->assertJsonCount(0, 'data');
    expect(Driver::count())->toBe(0);
});

it('não tem rota de leitura nem de alteração dos envios', function (string $method, string $uri) {
    DriverSubmission::factory()->create();

    $this->json($method, $uri, ['brand' => 'X'])->assertStatus(405);

    expect(DriverSubmission::count())->toBe(1);
})->with([
    ['GET', '/api/driver-submissions'],
    ['PUT', '/api/driver-submissions'],
    ['PATCH', '/api/driver-submissions'],
    ['DELETE', '/api/driver-submissions'],
]);

it('não tem rota para um envio específico', function (string $method) {
    $submission = DriverSubmission::factory()->create();

    $this->json($method, '/api/driver-submissions/'.$submission->id)->assertNotFound();
})->with(['GET', 'PUT', 'PATCH', 'DELETE']);

it('segue sem escrita no catálogo', function () {
    $this->postJson('/api/drivers', validSubmission())->assertStatus(405);
    expect(Driver::count())->toBe(0);
});

it('guarda o tipo opcional do envio', function () {
    $this->postJson('/api/driver-submissions', validSubmission(['type' => 'subwoofer']))->assertCreated();

    expect(DriverSubmission::query()->firstOrFail()->type)->toBe('subwoofer');
});

it('aceita envio sem tipo e recusa tipo fora da lista', function () {
    $this->postJson('/api/driver-submissions', validSubmission())->assertCreated();
    expect(DriverSubmission::query()->firstOrFail()->type)->toBeNull();

    $this->postJson('/api/driver-submissions', validSubmission(['model' => 'EX-15', 'type' => 'tuba']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('type');
});
