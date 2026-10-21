<?php

use App\Support\IpHash;

it('gera 64 caracteres hexadecimais e nunca contém o IP', function () {
    $hash = IpHash::make('203.0.113.7');

    expect($hash)->toMatch('/^[0-9a-f]{64}$/')
        ->and($hash)->not->toContain('203.0.113.7');
});

it('é estável para o mesmo IP e diferente para IPs diferentes', function () {
    expect(IpHash::make('203.0.113.7'))->toBe(IpHash::make('203.0.113.7'))
        ->and(IpHash::make('203.0.113.7'))->not->toBe(IpHash::make('203.0.113.8'));
});

it('depende da chave do app', function () {
    config(['app.key' => 'base64:'.base64_encode(str_repeat('a', 32))]);
    $first = IpHash::make('203.0.113.7');

    config(['app.key' => 'base64:'.base64_encode(str_repeat('b', 32))]);

    expect(IpHash::make('203.0.113.7'))->not->toBe($first);
});
