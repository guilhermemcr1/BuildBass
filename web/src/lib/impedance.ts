// A "variação" do driver é a impedância da bobina em ohms, guardada como "4 Ω" (o formato do
// catálogo e dos dados já existentes). A pessoa digita só o número; o símbolo é escrito pelo
// sistema. Mesma regra de api/app/Support/DriverVariant.php.
export const IMPEDANCE_MIN = 0.5;
export const IMPEDANCE_MAX = 64;
export const IMPEDANCE_SYMBOL = 'Ω';

// Variação lida: impedância de cada bobina e quantas são. Bobina dupla se escreve "4+4 Ω" (duas
// bobinas iguais de 4 Ω, cada uma com seu par de terminais).
export type Variant = { ohms: number; coils: 1 | 2 };

const NUMBER = String.raw`\d{1,3}(?:\.\d{1,2})?`;
const VARIANT = new RegExp(`^(${NUMBER})(?:\\s*\\+\\s*(${NUMBER}))?$`);

// "4", "4 Ω", "3,2 ohms" e "4+4 Ω" viram a variação; qualquer outra coisa (fora da faixa ou bobinas
// diferentes, como "4+2") é null.
export function parseVariant(value: string): Variant | null {
    const text = value
        .trim()
        .replaceAll(',', '.')
        .replace(/\s*(Ω|ohms?)$/iu, '')
        .trim();
    const match = VARIANT.exec(text);

    if (match === null) {
        return null;
    }

    const ohms = Number(match[1]);

    if (ohms < IMPEDANCE_MIN || ohms > IMPEDANCE_MAX) {
        return null;
    }

    if (match[2] === undefined) {
        return { ohms, coils: 1 };
    }

    return Number(match[2]) === ohms ? { ohms, coils: 2 } : null;
}

// Impedância de uma bobina ("4+4 Ω" dá 4); null quando não é uma variação válida.
export function parseOhms(value: string): number | null {
    return parseVariant(value)?.ohms ?? null;
}

// Quantas bobinas a variação descreve; sem variação (ou fora do padrão), uma.
export function voiceCoils(variant: string | undefined): 1 | 2 {
    return variant === undefined ? 1 : (parseVariant(variant)?.coils ?? 1);
}

// Impedância nominal do conjunto de bobinas de um driver: em série somam, em paralelo dividem.
export function coilLoad(
    variant: Variant,
    wiring: 'series' | 'parallel',
): number {
    if (variant.coils === 1) {
        return variant.ohms;
    }

    return wiring === 'series' ? variant.ohms * 2 : variant.ohms / 2;
}

// "4" vira "4 Ω", "3,20" vira "3.2 Ω" e "4+4" vira "4+4 Ω". Vazio continua vazio; o que não é
// impedância passa como veio (a validação o aponta).
export function formatImpedance(value: string): string {
    const trimmed = value.trim();

    if (trimmed === '') {
        return '';
    }

    const variant = parseVariant(trimmed);

    if (variant === null) {
        return trimmed;
    }

    return variant.coils === 2
        ? `${variant.ohms}+${variant.ohms} ${IMPEDANCE_SYMBOL}`
        : `${variant.ohms} ${IMPEDANCE_SYMBOL}`;
}

// Impedância válida (ou vazia): serve para o formulário aceitar ou recusar.
export function isImpedance(value: string): boolean {
    return value.trim() === '' || parseVariant(value) !== null;
}
