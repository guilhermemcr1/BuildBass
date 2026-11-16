import type { DriverInput } from '@/engine';
import type { DriverSource } from '@/lib/project/types';
import { NUMERIC_KEYS } from './schema';
import type { SubmissionForm } from './schema';

export function emptyForm(): SubmissionForm {
    return {
        brand: '',
        model: '',
        variant: '',
        type: '',
        source: '',
        contact_email: '',
        numbers: {},
    };
}

// Cópia do driver do projeto para o formulário: valores em SI, sem alterar o
// projeto; a identificação (fabricante, modelo, variante, tipo) pré-preenche a identificação quando existe.
export function formFromProject(
    driver: DriverInput,
    source: DriverSource | undefined,
): SubmissionForm {
    const form = emptyForm();
    const values = driver as Partial<Record<string, number>>;

    for (const key of NUMERIC_KEYS) {
        const value = values[key];

        if (value !== undefined && Number.isFinite(value)) {
            form.numbers[key] = value;
        }
    }

    if (source !== undefined) {
        form.brand = source.brand ?? '';
        form.model = source.model ?? '';
        form.variant = source.variant ?? '';
        form.type = source.type ?? '';
    }

    return form;
}

// Há algo digitado que se perderia ao fechar? (comparado com o estado inicial)
export function hasChanges(
    current: SubmissionForm,
    initial: SubmissionForm,
): boolean {
    return JSON.stringify(current) !== JSON.stringify(initial);
}
