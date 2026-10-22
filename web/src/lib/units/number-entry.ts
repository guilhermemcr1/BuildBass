// Entrada numérica tolerante: quem digita ou cola "28.5" no pt-BR ou "28,5" no inglês quer um
// decimal, mas o parser do navegador leria o ponto (pt-BR) ou a vírgula (en) como separador de
// milhar e guardaria 285 sem avisar. Aqui o texto é reescrito com o separador decimal do idioma
// antes de chegar ao campo.

type Separators = { decimal: string; group: string };

export function separatorsOf(locale: string): Separators {
    const parts = new Intl.NumberFormat(locale).formatToParts(1000.5);

    return {
        decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
        group: parts.find((part) => part.type === 'group')?.value ?? ',',
    };
}

// Tecla de ponto ou vírgula digitada: sempre vira o decimal do idioma (o que se vê é o que vale).
export function typedSeparator(data: string, locale: string): string {
    const { decimal } = separatorsOf(locale);

    return data === '.' || data === ',' ? decimal : data;
}

const MINUS = /[−‒–]/g;
const SPACES = /[\s  ']/g;

// Texto colado → texto para o campo, ou `undefined` quando não há número ali.
export function normalizePasted(
    raw: string,
    locale: string,
): string | undefined {
    const { decimal } = separatorsOf(locale);
    const cleaned = raw.replace(MINUS, '-').replace(SPACES, '');
    const match = /^[-+]?[\d.,]*\d(?:e[-+]?\d+)?/i.exec(cleaned);

    if (match === null) {
        return undefined;
    }

    const [text] = match;
    const [mantissa = '', exponent] = text.split(/e/i);
    const sign = mantissa.startsWith('-') ? '-' : '';
    let digits = mantissa.replace(/^[-+]/, '');
    const dots = digits.split('.').length - 1;
    const commas = digits.split(',').length - 1;
    let fraction = '';

    if (dots > 0 && commas > 0) {
        // Os dois aparecem: o último é o decimal, o outro é milhar.
        const at = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));

        fraction = digits.slice(at + 1);
        digits = digits.slice(0, at).replace(/[.,]/g, '');
    } else if (dots + commas > 0) {
        const mark = dots > 0 ? '.' : ',';
        const at = digits.lastIndexOf(mark);
        const head = digits.slice(0, at).replace(/[.,]/g, '');
        const tail = digits.slice(at + 1);
        // Um separador só: se é o decimal do idioma, é decimal. Se não, é milhar apenas quando
        // forma grupos de três ("1.000", "12.345.678"); "28.5" e "0.380" são decimais.
        const asGroup =
            dots + commas === 1 &&
            mark !== decimal &&
            tail.length === 3 &&
            head.length >= 1 &&
            head.length <= 3 &&
            head !== '0';

        if (asGroup || dots + commas > 1) {
            digits = digits.replace(/[.,]/g, '');
        } else {
            digits = head;
            fraction = tail;
        }
    }

    const base = Number(
        `${digits === '' ? '0' : digits}${fraction === '' ? '' : `.${fraction}`}`,
    );

    if (!Number.isFinite(base)) {
        return undefined;
    }

    const value = exponent === undefined ? base : base * 10 ** Number(exponent);

    if (!Number.isFinite(value)) {
        return undefined;
    }

    const plain = new Intl.NumberFormat('en-US', {
        useGrouping: false,
        maximumFractionDigits: 6,
    }).format(value);

    return `${sign}${plain.replace('.', decimal)}`;
}
