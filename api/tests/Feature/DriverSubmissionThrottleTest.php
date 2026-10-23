<?php

use App\Models\DriverSubmission;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function attempt(int $n, string $ip = '203.0.113.7')
{
    return test()->withServerVariables(['REMOTE_ADDR' => $ip])->postJson('/api/driver-submissions', [
        'brand' => 'Marca',
        'model' => "M-{$n}",
        'source' => 'Ficha',
        'contact_email' => 'pessoa@exemplo.com',
        'fs_hz' => 40,
        'qts' => 0.4,
        'vas_m3' => 0.05,
    ]);
}

it('aceita 5 envios por hora por IP e recusa o 6º com Retry-After sem gravar', function () {
    foreach (range(1, 5) as $n) {
        attempt($n)->assertCreated();
    }

    attempt(6)->assertStatus(429)->assertHeader('Retry-After');

    expect(DriverSubmission::count())->toBe(5);
});

it('envios recusados pela validação também contam no limite', function () {
    foreach (range(1, 5) as $n) {
        test()->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])
            ->postJson('/api/driver-submissions', ['brand' => 'x'])
            ->assertUnprocessable();
    }

    attempt(6)->assertStatus(429);

    expect(DriverSubmission::count())->toBe(0);
});

it('outro IP não é afetado', function () {
    foreach (range(1, 5) as $n) {
        attempt($n)->assertCreated();
    }

    attempt(6, '203.0.113.8')->assertCreated();
});

it('o limite do catálogo continua independente do limite de envios', function () {
    foreach (range(1, 5) as $n) {
        attempt($n)->assertCreated();
    }

    test()->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])->getJson('/api/drivers?q=marca')->assertOk();
});
