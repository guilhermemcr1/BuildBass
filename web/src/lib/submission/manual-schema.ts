import { z } from 'zod';
import { DRIVER_TYPES } from '@/lib/project/types';
import type { DriverType } from '@/lib/project/types';
import { NUMERIC_KEYS, rangeOf } from './schema';
import type { NumericKey } from './schema';

// Resposta da leitura de manual. O servidor já descarta o que
// sai das faixas; aqui as faixas são conferidas de novo, porque o front não confia no que recebe.

export const MANUAL_WARNINGS = [
    'review',
    'multiple_drivers',
    'nothing_found',
] as const;

export type ManualWarning = (typeof MANUAL_WARNINGS)[number];

export type ManualSuggestion = {
    brand?: string;
    model?: string;
    variant?: string;
    type?: DriverType;
    numbers: Partial<Record<NumericKey, number>>;
};

export type ManualResult = {
    suggestion: ManualSuggestion;
    // Campos que não fecham com os demais: preenchidos, mas para conferir.
    suspect: NumericKey[];
    // Parâmetros cujo valor o servidor deixou em branco (nome de campo do servidor).
    discarded: NumericKey[];
    warnings: ManualWarning[];
};

const envelope = z.object({
    data: z.object({
        suggestion: z.record(z.string(), z.unknown()),
        suspect: z.array(z.string()).default([]),
        discarded: z.array(z.string()).default([]),
        warnings: z.array(z.string()).default([]),
    }),
});

function numericKeys(values: string[]): NumericKey[] {
    return values.filter((value): value is NumericKey =>
        (NUMERIC_KEYS as string[]).includes(value),
    );
}

function plainText(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const text = value.trim();

    return text === '' ? undefined : text;
}

export function parseManualResponse(body: unknown): ManualResult | undefined {
    const parsed = envelope.safeParse(body);

    if (!parsed.success) {
        return undefined;
    }

    const { suggestion, suspect, discarded, warnings } = parsed.data.data;
    const numbers: Partial<Record<NumericKey, number>> = {};

    for (const key of NUMERIC_KEYS) {
        const value = suggestion[key];
        const { min, max } = rangeOf(key);

        if (
            typeof value === 'number' &&
            Number.isFinite(value) &&
            value >= min &&
            value <= max
        ) {
            numbers[key] = value;
        }
    }

    const type = suggestion.type;

    return {
        suggestion: {
            brand: plainText(suggestion.brand),
            model: plainText(suggestion.model),
            variant: plainText(suggestion.variant),
            type: (DRIVER_TYPES as readonly unknown[]).includes(type)
                ? (type as DriverType)
                : undefined,
            numbers,
        },
        suspect: numericKeys(suspect).filter((key) => key in numbers),
        discarded: numericKeys(discarded),
        warnings: warnings.filter((warning): warning is ManualWarning =>
            (MANUAL_WARNINGS as readonly string[]).includes(warning),
        ),
    };
}
