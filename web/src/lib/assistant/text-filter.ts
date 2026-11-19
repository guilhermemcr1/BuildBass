import { MANUAL_TEXT_MAX_CHARS } from '@/lib/submission/manual-client';

// Filtro do texto colado antes de mandar à IA, espelho do App\Services\Manual\ManualTextFilter: só
// seguem as linhas com um número junto de um nome de parâmetro ou unidade, mais as primeiras
// linhas curtas (marca e modelo). Links, e-mails e os sinais que poderiam fechar a marcação do
// prompt saem. O servidor filtra de novo: este aqui reduz o envio e mostra à pessoa o que vai.

const KEYWORDS = new RegExp(
    '(?<!\\p{L})(?:fs|f\\(s\\)|qts|q\\(ts\\)|qes|q\\(es\\)|qms|q\\(ms\\)|vas|v\\(as\\)|re|r\\(e\\)|le|l\\(e\\)|xmax|x\\(max\\)|sd|s\\(d\\)|pe|rms|bl|b\\s*l|mms|m\\(ms\\)|vd|v\\(d\\)|' +
        'hz|ohms?|Ω|mh|uh|µh|litros?|liters?|l|cm2|cm²|mm|cm|in|pol|polegadas?|inch(?:es)?|w|watts?|g|gramas?|grams?|kg|t·?m|' +
        'resson[âa]ncia|resonance|pot[êe]ncia|power|imped[âa]ncia|impedance|di[âa]metro|diameter|excurs[ãa]o|excursion|massa|mass|[áa]rea|area|' +
        'indut[âa]ncia|inductance|marca|brand|modelo|model)(?!\\p{L})',
    'iu',
);

const HEADER_LINES = 3;
const HEADER_MAX_CHARS = 40;
export const TEXT_MAX_LINES = 60;
const TEXT_MAX_LINE = 160;
export const TEXT_MAX_SENT = 3000;

export type FilteredText = {
    text: string;
    // Linhas com parâmetro; sem nenhuma, nada vai à IA.
    relevant: number;
    // Linhas descartadas pelo filtro (conversa, links, texto solto).
    dropped: number;
};

export function filterParameterText(raw: string): FilteredText {
    const clipped = raw.slice(0, MANUAL_TEXT_MAX_CHARS);
    const cleaned = clipped
        .replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/giu, ' ')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0008\u000B-\u001F\u007F<>{}[\]`]/gu, ' ');

    const kept: string[] = [];
    let relevant = 0;
    let dropped = 0;

    cleaned.split('\n').forEach((source, index) => {
        const line = source.replace(/[ \t]+/g, ' ').trim();

        if (line === '') {
            return;
        }

        if (kept.length >= TEXT_MAX_LINES) {
            dropped += 1;
            return;
        }

        const short = line.slice(0, TEXT_MAX_LINE);

        if (/\d/.test(short) && KEYWORDS.test(short)) {
            kept.push(short);
            relevant += 1;
        } else if (index < HEADER_LINES && short.length <= HEADER_MAX_CHARS) {
            kept.push(short);
        } else {
            dropped += 1;
        }
    });

    return {
        text: kept.join('\n').slice(0, TEXT_MAX_SENT),
        relevant,
        dropped,
    };
}
