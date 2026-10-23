<?php

use App\Services\Manual\ManualUnits;

it('converte cada unidade do manual para SI', function (string $key, float $value, string $unit, float $expected) {
    expect(ManualUnits::toSi($key, $value, $unit))->toEqualWithDelta($expected, abs($expected) * 1e-9 + 1e-15);
})->with([
    'Vas em litros' => ['vas_m3', 26.348, 'L', 0.026348],
    'Vas em pés cúbicos' => ['vas_m3', 1.0, 'ft3', 0.0283168466],
    'Vd em cm³' => ['vd_m3', 333.0, 'cm3', 0.000333],
    'Sd em cm²' => ['sd_m2', 530.9, 'cm2', 0.05309],
    'Sd em in²' => ['sd_m2', 10.0, 'in2', 0.00645160],
    'Mms em gramas' => ['mms_kg', 63.92, 'g', 0.06392],
    'Mms em onças' => ['mms_kg', 1.0, 'oz', 0.0283495231],
    'diâmetro em polegadas' => ['nominal_diameter_m', 12.0, 'in', 0.3048],
    'Xmax em mm' => ['xmax_m', 6.35, 'mm', 0.00635],
    'Le em mH' => ['le_h', 0.607, 'mH', 0.000607],
    'Le em µH' => ['le_h', 607.0, 'uH', 0.000607],
    'Fs em Hz' => ['fs_hz', 76.94, 'Hz', 76.94],
    'Re em ohm' => ['re_ohm', 3.0, 'ohm', 3.0],
    'Pe em W' => ['pe_w', 620.0, 'W', 620.0],
    'Bl em T·m' => ['bl_tm', 10.9, 'T·m', 10.9],
    'Qts sem unidade' => ['qts', 0.717, 'none', 0.717],
]);

it('reconhece os sinônimos das fichas', function (string $key, string $unit, float $factor) {
    expect(ManualUnits::toSi($key, 1.0, $unit))->toEqualWithDelta($factor, 1e-12);
})->with([
    'polegadas' => ['nominal_diameter_m', 'polegadas', 0.0254],
    'aspas' => ['nominal_diameter_m', '"', 0.0254],
    'cm com expoente' => ['sd_m2', 'cm²', 1e-4],
    'litros por extenso' => ['vas_m3', 'litros', 0.001],
    'Ohms' => ['re_ohm', 'Ohms', 1.0],
    'Ômega' => ['re_ohm', 'Ω', 1.0],
    'Tm' => ['bl_tm', 'Tm', 1.0],
    'N/A' => ['bl_tm', 'N/A', 1.0],
    'micro' => ['le_h', 'µH', 1e-6],
    'mH minúsculo' => ['le_h', 'mh', 0.001],
]);

it('devolve null para unidade desconhecida ou fora do parâmetro', function () {
    expect(ManualUnits::toSi('vas_m3', 1.0, 'furlong'))->toBeNull()
        ->and(ManualUnits::toSi('vas_m3', 1.0, 'g'))->toBeNull()
        ->and(ManualUnits::toSi('fs_hz', 1.0, 'kHz'))->toBeNull()
        ->and(ManualUnits::toSi('inexistente', 1.0, 'm'))->toBeNull();
});

it('expõe as unidades canônicas de cada parâmetro para o schema da IA', function () {
    expect(ManualUnits::unitsFor('vas_m3'))->toBe(['m3', 'L', 'cm3', 'ft3', 'in3'])
        ->and(ManualUnits::unitsFor('qts'))->toBe(['none'])
        ->and(ManualUnits::parameters())->toHaveKey('vas')
        ->and(ManualUnits::parameters()['vas'])->toBe('vas_m3');
});

it('converte sem deixar resto de ponto flutuante', function () {
    expect(ManualUnits::toSi('xmax_m', 9, 'mm'))->toBe(0.009)
        ->and(ManualUnits::toSi('le_h', 3.89, 'mH'))->toBe(0.00389)
        ->and(ManualUnits::toSi('nominal_diameter_m', 12, 'in'))->toBe(0.3048)
        ->and(ManualUnits::toSi('mms_kg', 154.76, 'g'))->toBe(0.15476)
        ->and(ManualUnits::toSi('vas_m3', 66.15, 'L'))->toBe(0.06615);
});
