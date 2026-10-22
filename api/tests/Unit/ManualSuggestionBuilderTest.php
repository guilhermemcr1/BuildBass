<?php

use App\Models\Driver;
use App\Services\Manual\ManualSuggestionBuilder;

/**
 * Driver como a ManualAiClient o devolve: tudo nulo, com as medidas informadas por cima.
 *
 * @param  array<string, array{0: float, 1: string}>  $measured  chave SI → [valor, unidade]
 * @param  array<string, mixed>  $identity
 * @return array<string, mixed>
 */
function aiRead(array $measured = [], array $identity = []): array
{
    $values = [];

    foreach (array_keys(Driver::RANGES) as $key) {
        $values[$key] = ['value' => null, 'unit' => null];
    }

    foreach ($measured as $key => [$value, $unit]) {
        $values[$key] = ['value' => $value, 'unit' => $unit];
    }

    return array_merge(['brand' => 'Triton', 'model' => 'TR 620', 'variant' => null, 'type' => 'woofer', 'values' => $values], $identity);
}

function ficha620(): array
{
    return aiRead([
        'nominal_diameter_m' => [12, 'in'],
        'fs_hz' => [76.94, 'Hz'],
        'qts' => [0.717, 'none'],
        'qes' => [0.779, 'none'],
        'qms' => [8.978, 'none'],
        'vas_m3' => [26.348, 'L'],
        're_ohm' => [3.0, 'ohm'],
        'le_h' => [0.607, 'mH'],
        'xmax_m' => [6.35, 'mm'],
        'sd_m2' => [530.9, 'cm2'],
        'pe_w' => [620, 'W'],
        'bl_tm' => [10.9, 'T·m'],
        'mms_kg' => [63.92, 'g'],
        'vd_m3' => [0.333, 'L'],
    ]);
}

it('converte a ficha para SI com as chaves do formulário', function () {
    $result = (new ManualSuggestionBuilder)->build([ficha620()]);
    $suggestion = $result['suggestion'];

    expect($suggestion['brand'])->toBe('Triton')
        ->and($suggestion['model'])->toBe('TR 620')
        ->and($suggestion['type'])->toBe('woofer')
        ->and($suggestion['nominal_diameter_m'])->toEqualWithDelta(0.3048, 1e-9)
        ->and($suggestion['vas_m3'])->toEqualWithDelta(0.026348, 1e-9)
        ->and($suggestion['sd_m2'])->toEqualWithDelta(0.05309, 1e-9)
        ->and($suggestion['mms_kg'])->toEqualWithDelta(0.06392, 1e-9)
        ->and($suggestion['le_h'])->toEqualWithDelta(0.000607, 1e-9)
        ->and($suggestion['xmax_m'])->toEqualWithDelta(0.00635, 1e-9)
        ->and($suggestion['vd_m3'])->toEqualWithDelta(0.000333, 1e-9)
        ->and($suggestion)->not->toHaveKey('source')
        ->and($result['suspect'])->toBe([])
        ->and($result['discarded'])->toBe([])
        ->and($result['warnings'])->toBe(['review']);
});

it('deixa nulo o que o manual não traz, sem estimar', function () {
    $result = (new ManualSuggestionBuilder)->build([aiRead(['fs_hz' => [40, 'Hz']])]);

    expect($result['suggestion']['fs_hz'])->toBe(40.0)
        ->and($result['suggestion']['qts'])->toBeNull()
        ->and($result['suggestion']['vas_m3'])->toBeNull()
        ->and($result['discarded'])->toBe([]);
});

it('usa só o primeiro driver e avisa quando há mais de um', function () {
    $result = (new ManualSuggestionBuilder)->build([
        ficha620(),
        aiRead(['fs_hz' => [30, 'Hz']], ['model' => 'TR 1250']),
    ]);

    expect($result['suggestion']['model'])->toBe('TR 620')
        ->and($result['suggestion']['fs_hz'])->toBe(76.94)
        ->and($result['warnings'])->toBe(['review', 'multiple_drivers']);
});

it('limpa e trunca os textos de identificação', function () {
    $result = (new ManualSuggestionBuilder)->build([aiRead(['fs_hz' => [40, 'Hz']], [
        'brand' => "  <b>Marca</b>\n  Grande ",
        'model' => str_repeat('M', 120),
        'variant' => str_repeat('v', 60),
        'type' => 'tweeter',
    ])]);

    expect($result['suggestion']['brand'])->toBe('Marca Grande')
        ->and(mb_strlen($result['suggestion']['model']))->toBe(80)
        ->and(mb_strlen($result['suggestion']['variant']))->toBe(40)
        ->and($result['suggestion']['type'])->toBeNull();
});

it('texto vazio vira nulo', function () {
    $result = (new ManualSuggestionBuilder)->build([aiRead(['fs_hz' => [40, 'Hz']], ['brand' => '   ', 'variant' => ''])]);

    expect($result['suggestion']['brand'])->toBeNull()
        ->and($result['suggestion']['variant'])->toBeNull();
});

it('descarta valor fora das faixas físicas e informa', function () {
    $result = (new ManualSuggestionBuilder)->build([aiRead([
        'fs_hz' => [40, 'Hz'],
        'qts' => [50, 'none'],
        'vas_m3' => [500, 'm3'],
    ])]);

    expect($result['suggestion']['qts'])->toBeNull()
        ->and($result['suggestion']['vas_m3'])->toBeNull()
        ->and($result['suggestion']['fs_hz'])->toBe(40.0)
        ->and($result['discarded'])->toBe(['qts', 'vas_m3']);
});

it('descarta valor com unidade desconhecida', function () {
    $result = (new ManualSuggestionBuilder)->build([aiRead([
        'fs_hz' => [40, 'Hz'],
        'vas_m3' => [3, 'furlong'],
        'mms_kg' => [60, null],
    ])]);

    expect($result['suggestion']['vas_m3'])->toBeNull()
        ->and($result['suggestion']['mms_kg'])->toBeNull()
        ->and($result['discarded'])->toBe(['vas_m3', 'mms_kg']);
});

it('marca Qts, Qes e Qms como suspeitos quando não fecham (mais de 10%)', function () {
    $result = (new ManualSuggestionBuilder)->build([aiRead([
        'qts' => [0.9, 'none'],
        'qes' => [0.779, 'none'],
        'qms' => [8.978, 'none'],
    ])]);

    expect($result['suspect'])->toBe(['qts', 'qes', 'qms'])
        ->and($result['suggestion']['qts'])->toBe(0.9);
});

it('aceita a ficha do TR 1250 sem suspeitos (arredondamento)', function () {
    $result = (new ManualSuggestionBuilder)->build([aiRead([
        'qts' => [0.42, 'none'], 'qes' => [0.44, 'none'], 'qms' => [9.88, 'none'],
        'sd_m2' => [488.8, 'cm2'], 'xmax_m' => [10.75, 'mm'], 'vd_m3' => [0.526, 'L'],
    ])]);

    expect($result['suspect'])->toBe([]);
});

it('marca Vd, Sd e Xmax como suspeitos quando Vd não bate com Sd·Xmax (mais de 15%)', function () {
    $result = (new ManualSuggestionBuilder)->build([aiRead([
        'sd_m2' => [530.9, 'cm2'], 'xmax_m' => [6.35, 'mm'], 'vd_m3' => [0.6, 'L'],
    ])]);

    expect($result['suspect'])->toBe(['vd_m3', 'sd_m2', 'xmax_m']);
});

it('não gera suspeito quando falta algum dos valores da regra', function () {
    $result = (new ManualSuggestionBuilder)->build([aiRead([
        'qts' => [0.9, 'none'], 'qes' => [0.779, 'none'],
        'sd_m2' => [530.9, 'cm2'], 'vd_m3' => [0.9, 'L'],
    ])]);

    expect($result['suspect'])->toBe([]);
});

it('avisa quando não encontra parâmetro nenhum', function (array $drivers) {
    $result = (new ManualSuggestionBuilder)->build($drivers);

    expect($result['warnings'])->toContain('nothing_found')
        ->and($result['suggestion']['fs_hz'])->toBeNull();
})->with([
    'lista vazia' => [[]],
    'tudo nulo' => [[['brand' => 'X', 'model' => 'Y', 'variant' => null, 'type' => null, 'values' => []]]],
]);
