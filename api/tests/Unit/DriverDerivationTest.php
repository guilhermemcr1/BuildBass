<?php

use App\Support\DriverDerivation;

// Mesmos números de web/src/lib/submission/auto-derive.test.ts: as duas pontas calculam igual.
it('Qes e Qms dão o Qts', function () {
    [$data, $auto] = DriverDerivation::sync(['qes' => 0.44, 'qms' => 8.37], []);

    expect($data['qts'])->toBe(0.418)->and($auto)->toBe(['qts']);
});

it('nunca sobrescreve o que foi digitado', function () {
    [$data, $auto] = DriverDerivation::sync(['qes' => 0.44, 'qms' => 8.37, 'qts' => 0.5], []);

    expect($data['qts'])->toBe(0.5)->and($auto)->toBe([]);
});

it('o calculado se atualiza quando a origem muda e some quando não dá mais para calcular', function () {
    [$data, $auto] = DriverDerivation::sync(['qes' => 0.44, 'qms' => 8.37], []);

    [$data, $auto] = DriverDerivation::sync([...$data, 'qms' => 4], $auto);
    expect($data['qts'])->toBe(0.3964)->and($auto)->toBe(['qts']);

    [$data, $auto] = DriverDerivation::sync([...$data, 'qms' => null], $auto);
    expect($data['qts'])->toBeNull()->and($auto)->toBe([]);
});

it('Fs, Mms (em gramas) e Sd (em cm²) dão o Vas (em litros)', function () {
    [$data] = DriverDerivation::sync(['fs_hz' => 28.93, 'mms_kg' => 154.76, 'sd_m2' => 400], []);

    expect($data['vas_m3'])->toBe(44.37);
});

it('resultado fora da faixa não é inserido', function () {
    [$data, $auto] = DriverDerivation::sync(['qes' => 0.06, 'qms' => 0.1], []);

    expect($data)->not->toHaveKey('qts')->and($auto)->toBe([]);
});
