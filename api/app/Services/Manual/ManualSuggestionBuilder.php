<?php

namespace App\Services\Manual;

use App\Http\Requests\StoreDriverSubmissionRequest;
use App\Models\Driver;
use App\Models\DriverSubmission;

// Da leitura bruta da IA para a sugestão do formulário (feature 009, research.md §3 e §4): converte
// para SI, descarta o que sai de Driver::RANGES e marca como suspeito o que não fecha entre si.
class ManualSuggestionBuilder
{
    /** Tolerância de Qts contra Qes e Qms; absorve o arredondamento das fichas. */
    private const QTS_TOLERANCE = 0.10;

    /** Tolerância de Vd contra Sd·Xmax. */
    private const VD_TOLERANCE = 0.15;

    private const TEXT_LIMITS = ['brand' => 80, 'model' => 80, 'variant' => 40];

    /**
     * @param  list<array{brand: ?string, model: ?string, variant: ?string, type: ?string, values: array<string, array{value: ?float, unit: ?string}>}>  $drivers
     * @return array{suggestion: array<string, string|float|null>, suspect: list<string>, discarded: list<string>, warnings: list<string>}
     */
    public function build(array $drivers): array
    {
        $first = $drivers[0] ?? null;
        $warnings = ['review'];

        if (count($drivers) > 1) {
            $warnings[] = 'multiple_drivers';
        }

        $numbers = [];
        $discarded = [];

        foreach (array_keys(Driver::RANGES) as $key) {
            $reading = $first['values'][$key] ?? ['value' => null, 'unit' => null];
            $numbers[$key] = null;

            if ($reading['value'] === null) {
                continue;
            }

            $si = ManualUnits::toSi($key, $reading['value'], $reading['unit']);

            if ($si === null || $si < Driver::RANGES[$key][0] || $si > Driver::RANGES[$key][1]) {
                $discarded[] = $key;

                continue;
            }

            $numbers[$key] = $si;
        }

        if (count(array_filter($numbers, fn (?float $value) => $value !== null)) === 0) {
            $warnings[] = 'nothing_found';
        }

        $type = $first['type'] ?? null;
        $suggestion = [];

        foreach (DriverSubmission::DRIVER_FIELDS as $field) {
            if ($field === 'source') {
                continue;
            }

            $suggestion[$field] = match (true) {
                isset(self::TEXT_LIMITS[$field]) => $this->text($first[$field] ?? null, self::TEXT_LIMITS[$field]),
                $field === 'type' => in_array($type, Driver::TYPES, true) ? $type : null,
                default => $numbers[$field] ?? null,
            };
        }

        return [
            'suggestion' => $suggestion,
            'suspect' => $this->suspect($numbers),
            'discarded' => $discarded,
            'warnings' => $warnings,
        ];
    }

    private function text(?string $value, int $max): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = mb_substr(StoreDriverSubmissionRequest::plainText($value), 0, $max);

        return $text === '' ? null : $text;
    }

    /**
     * @param  array<string, ?float>  $n  valores em SI por chave
     * @return list<string>
     */
    private function suspect(array $n): array
    {
        $suspect = [];

        // 1/Qts = 1/Qes + 1/Qms (Small, JAES 1972, "Direct-radiator loudspeaker system analysis").
        if ($n['qts'] !== null && $n['qes'] !== null && $n['qms'] !== null) {
            $expected = 1 / (1 / $n['qes'] + 1 / $n['qms']);

            if (abs($n['qts'] - $expected) / $n['qts'] > self::QTS_TOLERANCE) {
                array_push($suspect, 'qts', 'qes', 'qms');
            }
        }

        // Vd = Sd · Xmax: volume deslocado de pico pelo cone (definição).
        if ($n['vd_m3'] !== null && $n['sd_m2'] !== null && $n['xmax_m'] !== null) {
            $expected = $n['sd_m2'] * $n['xmax_m'];
            $reference = max($n['vd_m3'], $expected);

            if ($reference > 0 && abs($n['vd_m3'] - $expected) / $reference > self::VD_TOLERANCE) {
                array_push($suspect, 'vd_m3', 'sd_m2', 'xmax_m');
            }
        }

        return $suspect;
    }
}
