<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

it('aceita 3 análises por hora por IP e recusa a 4ª com Retry-After sem chamar a IA', function () {
    fakeManualPipeline();

    foreach (range(1, 3) as $ignored) {
        postManual()->assertOk();
    }

    postManual()->assertStatus(429)
        ->assertJsonPath('code', 'rate_limited')
        ->assertHeader('Retry-After');

    Http::assertSentCount(3);
});

it('outro IP não é afetado pelo limite', function () {
    fakeManualPipeline();

    foreach (range(1, 3) as $ignored) {
        postManual()->assertOk();
    }

    postManual(ip: '203.0.113.8')->assertOk();
});

it('o limite por hora é ajustável pelo ambiente e vale em qualquer APP_ENV', function () {
    fakeManualPipeline();
    config(['manual_extraction.hourly_limit' => 1]);

    expect(app()->environment())->not->toBe('production');

    postManual()->assertOk();
    postManual()->assertStatus(429);
});

it('para no teto diário global e responde indisponível sem chamar a IA', function () {
    fakeManualPipeline();
    config(['manual_extraction.daily_cap' => 1, 'manual_extraction.hourly_limit' => 10]);

    postManual()->assertOk();
    postManual(ip: '203.0.113.9')->assertStatus(503)->assertJsonPath('code', 'unavailable');

    Http::assertSentCount(1);
});

it('o limite do catálogo continua independente', function () {
    fakeManualPipeline();
    config(['manual_extraction.hourly_limit' => 1]);

    postManual()->assertOk();
    postManual()->assertStatus(429);

    test()->withServerVariables(['REMOTE_ADDR' => '203.0.113.7'])->getJson('/api/drivers?q=tr')->assertOk();
});
