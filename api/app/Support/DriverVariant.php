<?php

namespace App\Support;

/**
 * A variante do driver é a impedância da bobina em ohms, guardada como "4 Ω" (o formato que o
 * catálogo, o front e os dados já existentes usam). Bobina dupla é "4+4 Ω": duas bobinas iguais, e os
 * parâmetros da ficha são das duas em série. O painel pede só o número; este helper faz a leitura e a
 * escrita nesse formato, para o símbolo nunca ser digitado à mão. Mesma regra de web/src/lib/impedance.ts.
 */
final class DriverVariant
{
    public const MIN_OHM = 0.5;

    public const MAX_OHM = 64;

    public const SYMBOL = 'Ω';

    /** Valores comuns, oferecidos como sugestão no campo. */
    public const COMMON = ['1', '2', '4', '6', '8', '16'];

    private const NUMBER = '\\d{1,3}(?:\\.\\d{1,2})?';

    /**
     * "4 Ω", "4", "3,2" e "4+4 Ω" viram [ohms de uma bobina, quantas bobinas]; qualquer outra coisa
     * (fora da faixa ou bobinas diferentes, como "4+2") vira `null`.
     *
     * @return array{float, int}|null
     */
    public static function read(?string $value): ?array
    {
        $text = trim(str_replace(',', '.', (string) $value));
        $text = trim((string) preg_replace('/\s*(Ω|ohms?)$/iu', '', $text));

        if (! preg_match('/^('.self::NUMBER.')(?:\s*\+\s*('.self::NUMBER.'))?$/', $text, $match)) {
            return null;
        }

        $ohms = (float) $match[1];

        if ($ohms < self::MIN_OHM || $ohms > self::MAX_OHM) {
            return null;
        }

        if (! isset($match[2])) {
            return [$ohms, 1];
        }

        return (float) $match[2] === $ohms ? [$ohms, 2] : null;
    }

    /** Impedância de uma bobina ("4+4 Ω" dá 4.0); `null` quando não é uma variante válida. */
    public static function parse(?string $value): ?float
    {
        return self::read($value)[0] ?? null;
    }

    /** Quantas bobinas a variante descreve; vazia ou fora do padrão, uma. */
    public static function coils(?string $value): int
    {
        return self::read($value)[1] ?? 1;
    }

    /** "4" vira "4 Ω"; "3,20" vira "3.2 Ω"; "4+4" vira "4+4 Ω". Vazio continua vazio; o que não é impedância passa como veio. */
    public static function format(?string $value): string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return '';
        }

        $number = self::forInput($value);

        return self::read($value) === null ? $value : $number.' '.self::SYMBOL;
    }

    /** O que aparece no campo: sem o símbolo ("4 Ω" vira "4", "4+4 Ω" vira "4+4"); texto fora do padrão aparece como está. */
    public static function forInput(?string $stored): string
    {
        $stored = trim((string) $stored);
        $read = self::read($stored);

        if ($read === null) {
            return $stored;
        }

        [$ohms, $coils] = $read;
        $number = rtrim(rtrim(number_format($ohms, 2, '.', ''), '0'), '.');

        return $coils === 2 ? $number.'+'.$number : $number;
    }

    /** Só a impedância de uma bobina, para o campo numérico ("4+4 Ω" vira "4"); a bobina dupla é a caixa ao lado. */
    public static function ohmsForInput(?string $stored): string
    {
        $read = self::read($stored);

        return $read === null ? trim((string) $stored) : explode('+', self::forInput($stored))[0];
    }

    /** Monta o valor guardado a partir do número e da caixa: ("4", true) vira "4+4 Ω". */
    public static function compose(?string $ohms, bool $dual): string
    {
        $ohms = trim((string) $ohms);

        return self::format($dual && $ohms !== '' && self::read($ohms)[1] === 1 ? $ohms.'+'.$ohms : $ohms);
    }
}
