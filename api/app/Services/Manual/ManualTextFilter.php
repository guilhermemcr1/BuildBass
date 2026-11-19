<?php

namespace App\Services\Manual;

use App\Exceptions\Manual\ManualNoParametersException;

/**
 * Filtro do texto colado pelo visitante antes da IA: só seguem as linhas que podem trazer um
 * parâmetro (um número junto de um nome de parâmetro ou de uma unidade conhecida), mais as
 * primeiras linhas curtas, onde costumam ficar marca e modelo. Tudo o mais (links, e-mails,
 * instruções, conversa) fica de fora, assim como os sinais `<` e `>`, para o texto não fechar a
 * marcação `<manual>` do prompt. Os tetos de linhas e caracteres limitam o contexto enviado.
 */
class ManualTextFilter
{
    /** Nomes de parâmetro e unidades que justificam mandar a linha. */
    private const KEYWORDS = '/(?<![\p{L}])(?:fs|f\(s\)|qts|q\(ts\)|qes|q\(es\)|qms|q\(ms\)|vas|v\(as\)|re|r\(e\)|le|l\(e\)|xmax|x\(max\)|sd|s\(d\)|pe|rms|bl|b\s*l|mms|m\(ms\)|vd|v\(d\)|'
        .'hz|ohms?|Ω|mh|uh|µh|litros?|liters?|l|cm2|cm²|mm|cm|in|pol|polegadas?|inch(?:es)?|w|watts?|g|gramas?|grams?|kg|t·?m|'
        .'resson[âa]ncia|resonance|pot[êe]ncia|power|imped[âa]ncia|impedance|di[âa]metro|diameter|excurs[ãa]o|excursion|massa|mass|[áa]rea|area|'
        .'indut[âa]ncia|inductance|marca|brand|modelo|model)(?![\p{L}])/iu';

    /** Primeiras linhas curtas aceitas sem número (título com marca e modelo). */
    private const HEADER_LINES = 3;

    private const HEADER_MAX_CHARS = 40;

    /**
     * @throws ManualNoParametersException
     */
    public function filter(string $raw): string
    {
        $raw = mb_substr($raw, 0, (int) config('manual_extraction.text_max_input'));
        $text = (string) preg_replace('/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/iu', ' ', $raw);
        $text = (string) preg_replace('/[^\P{Cc}\n\t]|[<>{}\[\]`]/u', ' ', $text);

        $kept = [];
        $relevant = 0;
        $maxLines = (int) config('manual_extraction.text_max_lines');
        $maxLine = (int) config('manual_extraction.text_max_line');

        foreach (explode("\n", $text) as $index => $line) {
            $line = trim((string) preg_replace('/[ \t]+/', ' ', $line));

            if ($line === '') {
                continue;
            }

            $line = mb_substr($line, 0, $maxLine);
            $hasNumber = preg_match('/\d/', $line) === 1;

            if ($hasNumber && preg_match(self::KEYWORDS, $line) === 1) {
                $kept[] = $line;
                $relevant++;
            } elseif ($index < self::HEADER_LINES && mb_strlen($line) <= self::HEADER_MAX_CHARS) {
                $kept[] = $line;
            }

            if (count($kept) >= $maxLines) {
                break;
            }
        }

        if ($relevant === 0) {
            throw new ManualNoParametersException;
        }

        return mb_substr(implode("\n", $kept), 0, (int) config('manual_extraction.text_max_chars'));
    }
}
