import { DRIVER_KEYS, deriveDriver } from '@/engine';
import type { DriverInput } from '@/engine';
import { PARAMETERS } from '@/lib/parameters';
import type { NumericKey, SubmissionForm } from './schema';

// Parâmetros que o formulário preenche sozinho (Qts a partir de Qes e Qms, Vas a partir de Cms e
// Sd etc.), como no BASSBOX original. `auto` guarda quais campos do formulário têm valor
// calculado: o que a pessoa digita (ou o manual traz) nunca é tocado, e o calculado some ou se
// atualiza quando os campos de origem mudam.
export type AutoKeys = ReadonlySet<NumericKey>;

export const NO_AUTO: AutoKeys = new Set();

// Quatro algarismos significativos bastam para o cadastro e evitam "0.40594202898…" no campo.
function rounded(value: number): number {
    return Number(value.toPrecision(4));
}

function typedNumbers(
    numbers: SubmissionForm['numbers'],
    auto: AutoKeys,
): SubmissionForm['numbers'] {
    const typed = { ...numbers };

    for (const key of auto) {
        delete typed[key];
    }

    return typed;
}

// O formulário sem os valores calculados: o que realmente foi digitado ou lido do manual.
export function withoutAuto(
    form: SubmissionForm,
    auto: AutoKeys,
): SubmissionForm {
    return { ...form, numbers: typedNumbers(form.numbers, auto) };
}

// Recalcula os campos derivados a partir do que foi digitado e devolve o formulário com eles
// inseridos. Só entram valores dentro da faixa do campo (um cálculo absurdo vira campo vazio, e o
// erro de faixa continua com quem digitou).
export function syncDerived(
    form: SubmissionForm,
    auto: AutoKeys,
): { form: SubmissionForm; auto: AutoKeys } {
    const typed = typedNumbers(form.numbers, auto);
    const derived = deriveDriver(typed as DriverInput);
    const numbers = { ...typed };
    const nextAuto = new Set<NumericKey>();

    for (const key of DRIVER_KEYS) {
        if (key === 'le10k_h') {
            continue;
        }

        const { value, source } = derived.values[key];
        const { min, max } = PARAMETERS[key];

        if (
            typed[key] === undefined &&
            source === 'derived' &&
            value !== undefined
        ) {
            const shown = rounded(value);

            if (shown >= min && shown <= max) {
                numbers[key] = shown;
                nextAuto.add(key);
            }
        }
    }

    return { form: { ...form, numbers }, auto: nextAuto };
}
