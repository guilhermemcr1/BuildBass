// A "variação" do driver é a impedância da bobina em ohms, guardada como "4 Ω" (o formato do
// catálogo e dos dados já existentes). A pessoa digita só o número; o símbolo é escrito pelo
// sistema. Mesma regra de api/app/Support/DriverVariant.php.
export const IMPEDANCE_MIN = 0.5;
export const IMPEDANCE_MAX = 64;
export const IMPEDANCE_SYMBOL = 'Ω';

// "4", "4 Ω", "3,2" ou "3.2 ohms" viram o número; qualquer outra coisa (ou fora da faixa) é null.
export function parseOhms(value: string): number | null {
    const text = value
        .trim()
        .replace(',', '.')
        .replace(/\s*(Ω|ohms?)$/iu, '')
        .trim();

    if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) {
        return null;
    }

    const ohms = Number(text);

    return ohms >= IMPEDANCE_MIN && ohms <= IMPEDANCE_MAX ? ohms : null;
}

// "4" vira "4 Ω" e "3,20" vira "3.2 Ω". Vazio continua vazio; o que não é impedância passa como veio
// (a validação o aponta).
export function formatImpedance(value: string): string {
    const trimmed = value.trim();

    if (trimmed === '') {
        return '';
    }

    const ohms = parseOhms(trimmed);

    return ohms === null ? trimmed : `${ohms} ${IMPEDANCE_SYMBOL}`;
}

// Impedância válida (ou vazia): serve para o formulário aceitar ou recusar.
export function isImpedance(value: string): boolean {
    return value.trim() === '' || parseOhms(value) !== null;
}
