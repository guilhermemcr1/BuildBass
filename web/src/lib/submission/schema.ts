import { z } from 'zod';
import { DRIVER_KEYS } from '@/engine';
import type { DriverKey } from '@/engine';
import { PARAMETERS } from '@/lib/parameters';
import { DRIVER_TYPES } from '@/lib/project/types';
import type { DriverType } from '@/lib/project/types';

// Regras do envio de driver (specs/006, data-model.md §5). Espelham o Form Request do servidor
// (api/app/Http/Requests/StoreDriverSubmissionRequest.php); as faixas vêm de PARAMETERS e o
// servidor as confere pela fixture api/tests/Fixtures/submission-ranges.json.

export type NumericKey = DriverKey | 'nominal_diameter_m';

export const NUMERIC_KEYS: NumericKey[] = [
    'nominal_diameter_m',
    ...DRIVER_KEYS,
];

export const REQUIRED_KEYS: NumericKey[] = ['fs_hz', 'qts', 'vas_m3'];

export const OPTIONAL_KEYS: NumericKey[] = NUMERIC_KEYS.filter(
    (key) => !REQUIRED_KEYS.includes(key),
);

// Diâmetro nominal: mesma faixa do catálogo (lib/catalog/schema.ts).
const NOMINAL_DIAMETER_RANGE = { min: 0.03, max: 1.5 };

export const TEXT_LIMITS = {
    brand: 80,
    model: 80,
    variant: 40,
    source: 255,
    contact_email: 254,
} as const;

export function rangeOf(key: NumericKey): { min: number; max: number } {
    return key === 'nominal_diameter_m'
        ? NOMINAL_DIAMETER_RANGE
        : PARAMETERS[key];
}

export type SubmissionForm = {
    brand: string;
    model: string;
    variant: string;
    // Vazio = não informado.
    type: DriverType | '';
    source: string;
    contact_email: string;
    numbers: Partial<Record<NumericKey, number>>;
};

export type SubmissionFieldId =
    | 'brand'
    | 'model'
    | 'variant'
    | 'source'
    | 'contact_email'
    | NumericKey;

export type SubmissionErrorCode =
    | 'required'
    | 'tooLong'
    | 'email'
    | 'number'
    | 'range';

export type SubmissionErrors = Partial<
    Record<SubmissionFieldId, SubmissionErrorCode>
>;

function text(max: number, required: boolean) {
    const base = z.string().trim().max(max);

    return required ? base.min(1) : base;
}

function numberShape(): z.ZodObject {
    const shape: Record<string, z.ZodType> = {};

    for (const key of NUMERIC_KEYS) {
        const { min, max } = rangeOf(key);
        const range = z.number().min(min).max(max);

        shape[key] = REQUIRED_KEYS.includes(key) ? range : range.optional();
    }

    return z.object(shape);
}

export const submissionSchema = z.object({
    brand: text(TEXT_LIMITS.brand, true),
    model: text(TEXT_LIMITS.model, true),
    variant: text(TEXT_LIMITS.variant, false),
    type: z.union([z.literal(''), z.enum(DRIVER_TYPES)]),
    source: text(TEXT_LIMITS.source, true),
    // Obrigatório (specs/009): vazio é 'required'; preenchido precisa ser e-mail.
    contact_email: z
        .string()
        .trim()
        .min(1)
        .max(TEXT_LIMITS.contact_email)
        .refine((value) => z.email().safeParse(value).success, {
            message: 'email',
        }),
    numbers: numberShape(),
});

function codeFor(issue: z.core.$ZodIssue): SubmissionErrorCode {
    if (issue.code === 'invalid_type') {
        return issue.input === undefined ? 'required' : 'number';
    }

    if (issue.code === 'too_small') {
        return issue.origin === 'string' ? 'required' : 'range';
    }

    if (issue.code === 'too_big') {
        return issue.origin === 'string' ? 'tooLong' : 'range';
    }

    if (issue.code === 'custom') {
        return 'email';
    }

    return 'number';
}

export type Validation = { ok: true } | { ok: false; errors: SubmissionErrors };

export function validateSubmission(form: SubmissionForm): Validation {
    const result = submissionSchema.safeParse(form);

    if (result.success) {
        return { ok: true };
    }

    const errors: SubmissionErrors = {};

    for (const issue of result.error.issues) {
        const [first, second] = issue.path;
        const field = (first === 'numbers' ? second : first) as
            | SubmissionFieldId
            | undefined;

        if (field !== undefined && errors[field] === undefined) {
            errors[field] = codeFor(issue);
        }
    }

    return { ok: false, errors };
}

// Resposta do servidor ao criar o envio: o protocolo precisa ser um UUID.
export const submissionResponseSchema = z.object({
    data: z.object({ protocol: z.uuid(), status: z.literal('pending') }),
});

export type SubmissionPayload = Partial<Record<NumericKey, number>> & {
    brand: string;
    model: string;
    variant?: string;
    type?: DriverType;
    source: string;
    contact_email: string;
    locale: 'pt-BR' | 'en';
    // Campo-armadilha (FR-011): o usuário nunca o preenche.
    website: string;
    turnstile_token?: string;
};

// Valores em SI como estão no formulário; texto aparado, vazios fora do corpo (FR-007).
export function toPayload(
    form: SubmissionForm,
    extra: { locale: 'pt-BR' | 'en'; turnstileToken?: string },
): SubmissionPayload {
    const payload: SubmissionPayload = {
        brand: form.brand.trim(),
        model: form.model.trim(),
        source: form.source.trim(),
        contact_email: form.contact_email.trim(),
        locale: extra.locale,
        website: '',
    };
    const variant = form.variant.trim();

    if (variant !== '') {
        payload.variant = variant;
    }

    if (form.type !== '') {
        payload.type = form.type;
    }

    for (const key of NUMERIC_KEYS) {
        const value = form.numbers[key];

        if (value !== undefined) {
            payload[key] = value;
        }
    }

    if (extra.turnstileToken !== undefined) {
        payload.turnstile_token = extra.turnstileToken;
    }

    return payload;
}
