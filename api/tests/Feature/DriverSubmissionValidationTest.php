<?php

use App\Models\Driver;
use App\Models\DriverSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function baseSubmission(): array
{
    return [
        'brand' => 'Exemplo',
        'model' => 'EX-1',
        'source' => 'Ficha',
        'contact_email' => 'pessoa@exemplo.com',
        'fs_hz' => 40,
        'qts' => 0.4,
        'vas_m3' => 0.05,
    ];
}

it('recusa campo obrigatório ausente e não grava nada', function (string $field) {
    $payload = baseSubmission();
    unset($payload[$field]);

    $this->postJson('/api/driver-submissions', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    expect(DriverSubmission::count())->toBe(0);
})->with(['brand', 'model', 'source', 'fs_hz', 'qts', 'vas_m3']);

it('recusa parâmetro fora da faixa e aceita os limites exatos', function (string $key, float $min, float $max) {
    $below = $min - max(abs($min) * 0.01, 1e-9);
    $above = $max + max(abs($max) * 0.01, 1e-9);

    foreach ([$below, $above] as $value) {
        $this->postJson('/api/driver-submissions', [...baseSubmission(), $key => $value])
            ->assertUnprocessable()
            ->assertJsonValidationErrors($key);
    }

    expect(DriverSubmission::count())->toBe(0);

    foreach ([$min, $max] as $value) {
        $this->postJson('/api/driver-submissions', [...baseSubmission(), $key => $value, 'model' => "EX-{$key}-{$value}"])
            ->assertCreated();
    }
})->with(function () {
    foreach (Driver::RANGES as $key => [$min, $max]) {
        yield $key => [$key, (float) $min, (float) $max];
    }
});

it('recusa texto acima do tamanho', function (string $field, int $max) {
    $this->postJson('/api/driver-submissions', [...baseSubmission(), $field => str_repeat('a', $max + 1)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    $this->postJson('/api/driver-submissions', [...baseSubmission(), $field => str_repeat('a', $max)])
        ->assertCreated();
})->with([
    ['brand', 80],
    ['model', 80],
    ['variant', 40],
    ['source', 255],
]);

it('recusa e-mail inválido e valor que não é número', function () {
    $this->postJson('/api/driver-submissions', [...baseSubmission(), 'contact_email' => 'sem-arroba'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('contact_email');

    $this->postJson('/api/driver-submissions', [...baseSubmission(), 'qes' => 'muito'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('qes');

    expect(DriverSubmission::count())->toBe(0);
});

it('grava texto puro, sem marcação nem quebras de linha', function () {
    $this->postJson('/api/driver-submissions', [
        ...baseSubmission(),
        'brand' => '<b>Exemplo</b>  Áudio',
        'source' => "<script>alert(1)</script>Ficha\ndo  fabricante",
    ])->assertCreated();

    $submission = DriverSubmission::query()->firstOrFail();

    expect($submission->brand)->toBe('Exemplo Áudio')
        ->and($submission->source)->toBe('alert(1)Ficha do fabricante');
});

it('recusa texto que só tem marcação', function () {
    $this->postJson('/api/driver-submissions', [...baseSubmission(), 'brand' => '<b></b>'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('brand');
});

it('responde os erros no idioma do envio', function () {
    $payload = baseSubmission();
    unset($payload['brand']);

    $this->postJson('/api/driver-submissions', [...$payload, 'locale' => 'en'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.brand.0', 'Fill in this field.');

    $this->postJson('/api/driver-submissions', [...$payload, 'locale' => 'xx'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.brand.0', 'Preencha este campo.');
});

it('exige o e-mail de contato, também direto no servidor', function () {
    $withoutEmail = baseSubmission();
    unset($withoutEmail['contact_email']);

    $this->postJson('/api/driver-submissions', $withoutEmail)
        ->assertUnprocessable()
        ->assertJsonValidationErrors('contact_email');

    foreach (['', '   ', null] as $empty) {
        $this->postJson('/api/driver-submissions', [...baseSubmission(), 'contact_email' => $empty])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('contact_email');
    }

    expect(DriverSubmission::count())->toBe(0);
});

it('aceita o envio com e-mail válido', function () {
    $this->postJson('/api/driver-submissions', baseSubmission())->assertCreated();
});
