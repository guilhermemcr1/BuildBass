<?php

namespace App\Support;

/**
 * A variante do driver é a impedância da bobina em ohms, guardada como "4 Ω" (o formato que o
 * catálogo, o front e os dados já existentes usam). O painel pede só o número; este helper faz a
 * leitura e a escrita nesse formato, para o símbolo nunca ser digitado à mão.
 */
final class DriverVariant
{
    public const MIN_OHM = 0.5;

    public const MAX_OHM = 64;

    public const SYMBOL = 'Ω';

    /** Valores comuns, oferecidos como sugestão no campo. */
    public const COMMON = ['1', '2', '4', '6', '8', '16'];

    /** "4 Ω", "4", "3,2 Ω" ou "3.2" viram o número; qualquer outra coisa (ou fora da faixa) vira `null`. */
    public static function parse(?string $value): ?float
    {
        $text = trim(str_replace(',', '.', (string) $value));
        $text = trim((string) preg_replace('/\s*(Ω|ohms?)$/iu', '', $text));

        if (! preg_match('/^\d{1,3}(\.\d{1,2})?$/', $text)) {
            return null;
        }

        $ohms = (float) $text;

        return $ohms >= self::MIN_OHM && $ohms <= self::MAX_OHM ? $ohms : null;
    }

    /** "4" vira "4 Ω"; "3,20" vira "3.2 Ω". Vazio continua vazio; o que não é impedância passa como veio. */
    public static function format(?string $value): string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return '';
        }

        $ohms = self::parse($value);

        return $ohms === null ? $value : rtrim(rtrim(number_format($ohms, 2, '.', ''), '0'), '.').' '.self::SYMBOL;
    }

    /** O que aparece no campo: só o número ("4 Ω" vira "4"); texto antigo fora do padrão aparece como está. */
    public static function forInput(?string $stored): string
    {
        $stored = trim((string) $stored);
        $ohms = self::parse($stored);

        return $ohms === null ? $stored : rtrim(rtrim(number_format($ohms, 2, '.', ''), '0'), '.');
    }
}
