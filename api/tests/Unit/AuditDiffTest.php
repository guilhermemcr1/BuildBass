<?php

use App\Services\Audit\AuditDiff;

it('devolve só os campos que mudaram, com antes e depois', function () {
    $changes = AuditDiff::between(
        ['qts' => 0.4, 'fs_hz' => 40.0, 'brand' => 'Triton'],
        ['qts' => 0.45, 'fs_hz' => 40.0, 'brand' => 'Triton'],
        ['qts', 'fs_hz', 'brand'],
    );

    expect($changes)->toBe(['qts' => [0.4, 0.45]]);
});

it('devolve lista vazia sem mudança', function () {
    expect(AuditDiff::between(['qts' => 0.4], ['qts' => 0.4], ['qts']))->toBe([]);
});

it('trata variante vazia e nula como a mesma coisa', function () {
    expect(AuditDiff::between(['variant' => ''], ['variant' => null], ['variant']))->toBe([]);
});

it('compara números como float', function () {
    expect(AuditDiff::between(['pe_w' => 300], ['pe_w' => 300.0], ['pe_w']))->toBe([]);
});

it('ignora campos fora da lista e registra campo que passou a ter valor', function () {
    $changes = AuditDiff::between(
        ['qes' => null, 'source' => 'a'],
        ['qes' => 0.5, 'source' => 'b'],
        ['qes'],
    );

    expect($changes)->toBe(['qes' => [null, 0.5]]);
});
