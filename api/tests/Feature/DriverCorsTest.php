<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('libera a origem do front no catálogo', function () {
    $this->withHeaders(['Origin' => 'http://localhost:5173'])
        ->getJson('/api/drivers?q=triton')
        ->assertOk()
        ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
});

it('não libera outra origem: o cabeçalho nunca é a origem pedida nem curinga', function () {
    $response = $this->withHeaders(['Origin' => 'http://evil.example'])
        ->getJson('/api/drivers?q=triton');

    // O servidor só anuncia a origem do front; o navegador bloqueia a resposta para as demais.
    expect($response->headers->get('Access-Control-Allow-Origin'))
        ->not->toBe('http://evil.example')
        ->not->toBe('*');
});

it('no pré-voo libera GET e POST (envio) e não libera PUT, PATCH nem DELETE', function () {
    $preflight = fn (string $method) => $this->call(
        'OPTIONS',
        '/api/drivers',
        [],
        [],
        [],
        $this->transformHeadersToServerVars([
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => $method,
        ]),
    );

    $methods = (string) $preflight('POST')->headers->get('Access-Control-Allow-Methods');

    expect($methods)->toContain('GET')
        ->and($methods)->toContain('POST')
        ->and($methods)->not->toContain('PUT')
        ->and($methods)->not->toContain('PATCH')
        ->and($methods)->not->toContain('DELETE');
});

it('libera a origem do front no envio de driver e não libera outra origem', function () {
    $allowed = $this->withHeaders(['Origin' => 'http://localhost:5173'])
        ->postJson('/api/driver-submissions', []);
    $other = $this->withHeaders(['Origin' => 'http://evil.example'])
        ->postJson('/api/driver-submissions', []);

    expect($allowed->headers->get('Access-Control-Allow-Origin'))->toBe('http://localhost:5173')
        ->and($other->headers->get('Access-Control-Allow-Origin'))
        ->not->toBe('http://evil.example')
        ->not->toBe('*');
});
