<?php

namespace App\Services\Manual;

use function mb_strtolower;

/**
 * Unidades que aparecem nos manuais de alto-falante e seus fatores para o SI (feature 009). A IA só
 * devolve valor + unidade; a conta é aqui, para ser determinística. Fatores: definições do SI e das
 * unidades imperiais (1 in = 0,0254 m; 1 ft³ = 0,0283168466 m³; 1 in³ = 1,6387064e-5 m³;
 * 1 oz = 0,0283495231 kg). As chaves SI são as de Driver::RANGES.
 */
class ManualUnits
{
    /** Nome usado no schema da IA → chave SI do formulário. */
    private const PARAMETERS = [
        'nominal_diameter' => 'nominal_diameter_m',
        'fs' => 'fs_hz',
        'qts' => 'qts',
        'vas' => 'vas_m3',
        'qes' => 'qes',
        'qms' => 'qms',
        're' => 're_ohm',
        'le' => 'le_h',
        'xmax' => 'xmax_m',
        'sd' => 'sd_m2',
        'pe' => 'pe_w',
        'bl' => 'bl_tm',
        'mms' => 'mms_kg',
        'vd' => 'vd_m3',
    ];

    private const LENGTH = ['m' => 1.0, 'cm' => 0.01, 'mm' => 0.001, 'in' => 0.0254];

    private const VOLUME = ['m3' => 1.0, 'L' => 0.001, 'cm3' => 1e-6, 'ft3' => 0.0283168466, 'in3' => 1.6387064e-5];

    /** Unidade canônica → fator, por chave SI. */
    private const FACTORS = [
        'nominal_diameter_m' => self::LENGTH,
        'xmax_m' => self::LENGTH,
        'fs_hz' => ['Hz' => 1.0],
        'qts' => ['none' => 1.0],
        'qes' => ['none' => 1.0],
        'qms' => ['none' => 1.0],
        'vas_m3' => self::VOLUME,
        'vd_m3' => self::VOLUME,
        're_ohm' => ['ohm' => 1.0],
        'le_h' => ['H' => 1.0, 'mH' => 0.001, 'uH' => 1e-6],
        'sd_m2' => ['m2' => 1.0, 'cm2' => 1e-4, 'mm2' => 1e-6, 'in2' => 6.4516e-4],
        'pe_w' => ['W' => 1.0],
        'bl_tm' => ['T·m' => 1.0],
        'mms_kg' => ['kg' => 1.0, 'g' => 0.001, 'mg' => 1e-6, 'oz' => 0.0283495231],
    ];

    /** Escrita em minúsculas, sem espaços → unidade canônica. */
    private const SYNONYMS = [
        'm' => 'm', 'cm' => 'cm', 'mm' => 'mm', 'in' => 'in', 'pol' => 'in', 'polegada' => 'in',
        'polegadas' => 'in', 'inch' => 'in', 'inches' => 'in', '"' => 'in', '”' => 'in', '″' => 'in',
        'hz' => 'Hz',
        'none' => 'none', '' => 'none', '-' => 'none',
        'm3' => 'm3', 'l' => 'L', 'lt' => 'L', 'litro' => 'L', 'litros' => 'L', 'liter' => 'L',
        'liters' => 'L', 'cm3' => 'cm3', 'cc' => 'cm3', 'ft3' => 'ft3', 'in3' => 'in3',
        'ohm' => 'ohm', 'ohms' => 'ohm', 'ω' => 'ohm',
        'h' => 'H', 'mh' => 'mH', 'uh' => 'uH', 'µh' => 'uH', 'μh' => 'uH',
        'm2' => 'm2', 'cm2' => 'cm2', 'mm2' => 'mm2', 'in2' => 'in2',
        'w' => 'W', 'watt' => 'W', 'watts' => 'W',
        't·m' => 'T·m', 't.m' => 'T·m', 't*m' => 'T·m', 'tm' => 'T·m', 'n/a' => 'T·m', 't/m' => 'T·m',
        'kg' => 'kg', 'g' => 'g', 'mg' => 'mg', 'oz' => 'oz',
    ];

    /**
     * @return array<string, string> nome no schema da IA → chave SI
     */
    public static function parameters(): array
    {
        return self::PARAMETERS;
    }

    /**
     * @return list<string> unidades canônicas aceitas para a chave SI (enum do schema da IA)
     */
    public static function unitsFor(string $key): array
    {
        return array_keys(self::FACTORS[$key] ?? []);
    }

    /**
     * Valor no SI, ou null se a unidade não existe para esse parâmetro.
     */
    public static function toSi(string $key, float $value, ?string $unit): ?float
    {
        $factors = self::FACTORS[$key] ?? null;

        if ($factors === null) {
            return null;
        }

        $canonical = self::normalize($unit ?? 'none');

        if ($canonical === null || ! isset($factors[$canonical])) {
            return null;
        }

        return $value * $factors[$canonical];
    }

    private static function normalize(string $unit): ?string
    {
        $clean = mb_strtolower(trim($unit));
        $clean = str_replace(['²', '³', ' '], ['2', '3', ''], $clean);

        return self::SYNONYMS[$clean] ?? null;
    }
}
