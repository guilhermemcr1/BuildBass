import { CUT_PLAN_LIMITS } from '@/cutplan/config';
import { DRIVER_KEYS } from '@/engine';
import type { DriverInput } from '@/engine';
import { PARAMETERS } from '@/lib/parameters';
import { isDriverType } from '@/lib/project/types';
import { SAVED_DRIVER_LIMITS } from './types';
import type { SavedDriver, SavedDriverDraft } from './types';

// Validação leve, sem Zod, do que o navegador devolve (specs/008, R11): o localStorage é terreno
// do usuário, então item sem a forma esperada é descartado. O arquivo de importação usa Zod
// (carregado sob demanda), com as mesmas faixas.

function record(value: unknown): Record<string, unknown> | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}

function textWithin(
    value: unknown,
    limit: { min: number; max: number },
): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    const trimmed = value.trim();

    return trimmed.length >= limit.min && trimmed.length <= limit.max
        ? trimmed
        : undefined;
}

function numberWithin(
    value: unknown,
    limit: { min: number; max: number },
): number | undefined {
    return typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= limit.min &&
        value <= limit.max
        ? value
        : undefined;
}

// Os parâmetros do driver seguem as faixas de PARAMETERS; chave desconhecida é ignorada e valor
// fora da faixa invalida o item.
function sanitizeDriver(raw: unknown): DriverInput | undefined {
    const source = record(raw);

    if (source === undefined) {
        return undefined;
    }

    const driver: DriverInput = {};

    for (const key of DRIVER_KEYS) {
        const value = source[key];

        if (value === undefined) {
            continue;
        }

        const valid = numberWithin(value, PARAMETERS[key]);

        if (valid === undefined) {
            return undefined;
        }

        driver[key] = valid;
    }

    return driver;
}

// Um campo opcional: ausente passa; presente e inválido invalida o item.
function optional(
    value: unknown,
    limit: { min: number; max: number },
): { ok: true; value?: number } | { ok: false } {
    if (value === undefined) {
        return { ok: true };
    }

    const valid = numberWithin(value, limit);

    return valid === undefined ? { ok: false } : { ok: true, value: valid };
}

export function sanitizeDraft(raw: unknown): SavedDriverDraft | undefined {
    const source = record(raw);

    if (source === undefined) {
        return undefined;
    }

    const brand = textWithin(source.brand, SAVED_DRIVER_LIMITS.brand);
    const model = textWithin(source.model, SAVED_DRIVER_LIMITS.model);
    const driver = sanitizeDriver(source.driver);
    const variant =
        source.variant === undefined
            ? undefined
            : textWithin(source.variant, SAVED_DRIVER_LIMITS.variant);
    const diameter = optional(
        source.nominal_diameter_m,
        SAVED_DRIVER_LIMITS.nominal_diameter_m,
    );
    // Tipo que este app não conhece (de uma versão futura) é ignorado, sem perder o item.
    const type = isDriverType(source.type) ? source.type : undefined;
    const cutout = optional(source.cutout_m, CUT_PLAN_LIMITS.cutout_m);
    const depth = optional(source.depth_m, SAVED_DRIVER_LIMITS.depth_m);

    if (
        brand === undefined ||
        model === undefined ||
        driver === undefined ||
        (source.variant !== undefined && variant === undefined) ||
        !diameter.ok ||
        !cutout.ok ||
        !depth.ok
    ) {
        return undefined;
    }

    return {
        brand,
        model,
        ...(variant === undefined ? {} : { variant }),
        ...(type === undefined ? {} : { type }),
        driver,
        ...(diameter.value === undefined
            ? {}
            : { nominal_diameter_m: diameter.value }),
        ...(cutout.value === undefined ? {} : { cutout_m: cutout.value }),
        ...(depth.value === undefined ? {} : { depth_m: depth.value }),
    };
}

export function sanitizeSavedDriver(raw: unknown): SavedDriver | undefined {
    const source = record(raw);
    const draft = sanitizeDraft(raw);

    if (
        source === undefined ||
        draft === undefined ||
        typeof source.id !== 'string' ||
        source.id === '' ||
        typeof source.savedAt !== 'string' ||
        Number.isNaN(Date.parse(source.savedAt))
    ) {
        return undefined;
    }

    return { ...draft, id: source.id, savedAt: source.savedAt };
}
