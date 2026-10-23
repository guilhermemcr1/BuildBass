// Medida e adaptação de texto para a imagem exportada. As larguras são as métricas públicas das
// fontes padrão do PDF, Helvetica e Helvetica-Bold (Adobe Core 14 AFM), em 1/1000 de em. O SVG usa
// "Helvetica, Arial": Arial tem as mesmas larguras. Assim o layout é igual no SVG, no PNG e no PDF
// e dá para medir sem canvas.

// ASCII 32 (espaço) a 126 (~).
const REGULAR = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278,
    278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
    584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556,
    833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
    278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222,
    500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
    500, 334, 260, 334, 584,
];

const BOLD = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278,
    278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
    584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611,
    833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
    278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278,
    556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
    500, 389, 280, 389, 584,
];

// Fora do ASCII: largura própria; letras acentuadas usam a da letra-base.
const SPECIAL: Record<string, [number, number]> = {
    '°': [400, 400],
    '·': [278, 278],
    '–': [556, 556],
    '—': [1000, 1000],
    '…': [1000, 1000],
    '×': [584, 584],
    µ: [556, 611],
    '²': [333, 333],
    '³': [333, 333],
    '•': [350, 350],
};

const FALLBACK = 556;

function glyphWidth(char: string, bold: boolean): number {
    const code = char.charCodeAt(0);

    if (code >= 32 && code <= 126) {
        return (bold ? BOLD : REGULAR)[code - 32];
    }

    const special = SPECIAL[char];

    if (special !== undefined) {
        return special[bold ? 1 : 0];
    }

    const base = char.normalize('NFD').charAt(0);
    const baseCode = base.charCodeAt(0);

    if (base !== char && baseCode >= 32 && baseCode <= 126) {
        return (bold ? BOLD : REGULAR)[baseCode - 32];
    }

    return FALLBACK;
}

export function measure(text: string, size: number, bold = false): number {
    let total = 0;

    for (const char of text) {
        total += glyphWidth(char, bold);
    }

    return (total * size) / 1000;
}

// Quebra em espaços para caber em `maxWidth`. Palavra maior que a linha fica sozinha (não corta).
export function wrap(
    text: string,
    size: number,
    bold: boolean,
    maxWidth: number,
): string[] {
    const lines: string[] = [];
    let current = '';

    text.split(/\s+/)
        .filter((word) => word !== '')
        .forEach((word) => {
            const candidate = current === '' ? word : `${current} ${word}`;

            if (current === '' || measure(candidate, size, bold) <= maxWidth) {
                current = candidate;

                return;
            }

            lines.push(current);
            current = word;
        });

    if (current !== '') {
        lines.push(current);
    }

    return lines;
}

const REPLACEMENTS: [RegExp, string][] = [
    [/Ω/g, 'ohm'],
    [/[−]/g, '-'],
    [/≈/g, '~'],
    [/≤/g, '<='],
    [/≥/g, '>='],
    [/[   ]/g, ' '],
];

// Caracteres que o WinAnsi (e portanto o PDF com fonte padrão) representa fora do Latin-1.
const WIN_ANSI_EXTRA = '–—‘’“”•…€™';

// Troca o que o WinAnsi não tem e põe "?" no que sobrar. Roda sobre todo texto da cena, para o
// SVG, o PNG e o PDF dizerem a mesma coisa.
export function toWinAnsi(text: string): string {
    const replaced = REPLACEMENTS.reduce(
        (result, [pattern, to]) => result.replace(pattern, to),
        text,
    );

    return Array.from(replaced, (char) => {
        const code = char.charCodeAt(0);

        return (code >= 32 && code <= 126) ||
            (code >= 0xa1 && code <= 0xff) ||
            WIN_ANSI_EXTRA.includes(char)
            ? char
            : '?';
    }).join('');
}
