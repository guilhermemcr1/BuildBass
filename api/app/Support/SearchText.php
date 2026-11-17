<?php

namespace App\Support;

use Illuminate\Support\Str;

class SearchText
{
    /**
     * Minúsculas, sem acento e com espaços colapsados. O model grava o texto do cadastro por aqui
     * e a busca normaliza o termo pela mesma regra, então o resultado é igual no MySQL e no SQLite.
     */
    public static function normalize(string $text): string
    {
        $plain = Str::ascii(Str::lower($text));

        return trim((string) preg_replace('/\s+/u', ' ', $plain));
    }

    /**
     * @return list<string>
     */
    public static function words(string $term): array
    {
        $normalized = self::normalize($term);

        return $normalized === '' ? [] : explode(' ', $normalized);
    }

    /** Termo já normalizado sem espaço, hífen, ponto e barra: "ts-w3010" vira "tsw3010". */
    public static function compact(string $word): string
    {
        return str_replace([' ', '-', '.', '/'], '', $word);
    }
}
