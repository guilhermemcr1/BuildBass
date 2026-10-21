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

it('no pré-voo libera GET e não libera métodos de escrita', function () {
    $headers = [
        'Origin' => 'http://localhost:5173',
        'Access-Control-Request-Method' => 'POST',
    ];

    $response = $this->call('OPTIONS', '/api/drivers', [], [], [], $this->transformHeadersToServerVars($headers));
    $methods = (string) $response->headers->get('Access-Control-Allow-Methods');

    expect($methods)->not->toContain('POST')
        ->and($methods)->not->toContain('PUT')
        ->and($methods)->not->toContain('DELETE')
        ->and($methods)->toContain('GET');
});
