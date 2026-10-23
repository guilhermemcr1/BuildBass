<?php

namespace App\Support;

use App\Filament\Schemas\DriverParameterFields;
use App\Models\Driver;

/**
 * Parâmetros que se calculam dos outros (Qts de Qes e Qms, Vas de Cms e Sd…), para o painel inserir
 * o valor sozinho como o BASSBOX original. Mesmas relações de Thiele-Small de
 * web/src/engine/driver.ts ([S72], Small, JAES 1972), em SI, aplicadas até nada mudar. O que a
 * pessoa digitou (ou o manual trouxe) nunca é tocado; o calculado é marcado em `auto_keys` e se
 * atualiza, ou some, quando os campos de origem mudam.
 */
final class DriverDerivation
{
    /** Campos do formulário que participam das relações. */
    public const KEYS = ['fs_hz', 'qts', 'qes', 'qms', 'vas_m3', 're_ohm', 'sd_m2', 'mms_kg', 'bl_tm'];

    /** Ar a 20 °C e 101,325 kPa, os mesmos valores fixos da bancada. */
    private const AIR_DENSITY = 1.204;

    private const SPEED_OF_SOUND = 343.2;

    /**
     * @param  array<string, mixed>  $data  valores do formulário, nas unidades que o painel mostra
     * @param  list<string>  $auto  campos que estavam com valor calculado
     * @return array{0: array<string, mixed>, 1: list<string>} dados com os calculados inseridos e os novos `auto`
     */
    public static function sync(array $data, array $auto): array
    {
        $typed = [];

        foreach (self::KEYS as $key) {
            $value = $data[$key] ?? null;

            if (! in_array($key, $auto, true) && is_numeric($value) && (float) $value > 0) {
                $typed[$key] = (float) $value * (DriverParameterFields::FACTORS[$key] ?? 1.0);
            }
        }

        $derived = self::derive($typed);
        $nextAuto = [];

        foreach (self::KEYS as $key) {
            if (isset($typed[$key])) {
                continue;
            }

            $si = $derived[$key] ?? null;
            $inRange = $si !== null && $si >= Driver::RANGES[$key][0] && $si <= Driver::RANGES[$key][1];

            if ($inRange) {
                $data[$key] = DriverParameterFields::toDisplay($key, $si, 4);
                $nextAuto[] = $key;
            } elseif (in_array($key, $auto, true)) {
                $data[$key] = null;
            }
        }

        return [$data, $nextAuto];
    }

    /**
     * Valores em SI que as relações permitem calcular a partir dos informados (inclui os informados).
     *
     * @param  array<string, float>  $typed
     * @return array<string, float>
     */
    public static function derive(array $typed): array
    {
        $v = $typed;
        $rhoC2 = self::AIR_DENSITY * self::SPEED_OF_SOUND ** 2;
        $twoPi = 2 * M_PI;

        // alvo => [necessários, conta]. Cms (m/N) é intermediário e não é campo.
        $rules = [
            ['qts', ['qes', 'qms'], fn (array $v): float => $v['qes'] * $v['qms'] / ($v['qes'] + $v['qms'])],
            ['qes', ['qts', 'qms'], fn (array $v): float => $v['qts'] * $v['qms'] / ($v['qms'] - $v['qts'])],
            ['qms', ['qts', 'qes'], fn (array $v): float => $v['qts'] * $v['qes'] / ($v['qes'] - $v['qts'])],
            ['cms', ['vas_m3', 'sd_m2'], fn (array $v): float => $v['vas_m3'] / ($rhoC2 * $v['sd_m2'] ** 2)],
            ['cms', ['fs_hz', 'mms_kg'], fn (array $v): float => 1 / (($twoPi * $v['fs_hz']) ** 2 * $v['mms_kg'])],
            ['mms_kg', ['fs_hz', 'cms'], fn (array $v): float => 1 / (($twoPi * $v['fs_hz']) ** 2 * $v['cms'])],
            ['fs_hz', ['mms_kg', 'cms'], fn (array $v): float => 1 / ($twoPi * sqrt($v['mms_kg'] * $v['cms']))],
            ['vas_m3', ['cms', 'sd_m2'], fn (array $v): float => $v['cms'] * $rhoC2 * $v['sd_m2'] ** 2],
            ['bl_tm', ['fs_hz', 'mms_kg', 're_ohm', 'qes'], fn (array $v): float => sqrt($twoPi * $v['fs_hz'] * $v['mms_kg'] * $v['re_ohm'] / $v['qes'])],
            ['qes', ['fs_hz', 'mms_kg', 're_ohm', 'bl_tm'], fn (array $v): float => $twoPi * $v['fs_hz'] * $v['mms_kg'] * $v['re_ohm'] / $v['bl_tm'] ** 2],
            ['mms_kg', ['fs_hz', 're_ohm', 'qes', 'bl_tm'], fn (array $v): float => $v['qes'] * $v['bl_tm'] ** 2 / ($twoPi * $v['fs_hz'] * $v['re_ohm'])],
        ];

        do {
            $changed = false;

            foreach ($rules as [$target, $needs, $compute]) {
                if (isset($v[$target])) {
                    continue;
                }

                foreach ($needs as $need) {
                    if (! isset($v[$need])) {
                        continue 2;
                    }
                }

                $result = $compute($v);

                if (is_finite($result) && $result > 0) {
                    $v[$target] = $result;
                    $changed = true;
                }
            }
        } while ($changed);

        unset($v['cms']);

        return $v;
    }

    /**
     * Roda `sync` sobre o estado do formulário, com os campos calculados em `auto_keys`.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public static function apply(array $data): array
    {
        $auto = array_values(array_filter((array) ($data['auto_keys'] ?? []), 'is_string'));
        [$data, $auto] = self::sync($data, $auto);
        $data['auto_keys'] = $auto;

        return $data;
    }
}
