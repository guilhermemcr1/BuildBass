import type { DriverInput } from '@/engine';
import type { DriverType } from '@/lib/project/types';

// Alto-falante salvo pelo usuário. Tudo em SI. Guardado só no
// navegador; não há conta nem servidor por trás.
export type SavedDriverDraft = {
    brand: string;
    model: string;
    variant?: string;
    type?: DriverType;
    driver: DriverInput;
    nominal_diameter_m?: number;
    cutout_m?: number;
    depth_m?: number;
};

export type SavedDriver = SavedDriverDraft & {
    // UUID v4 (chave primária).
    id: string;
    // ISO 8601, para ordenar.
    savedAt: string;
};

export const SAVED_DRIVERS_MAX = 200;
export const SAVED_DRIVERS_MAX_BYTES = 512 * 1024;

export const SAVED_DRIVER_LIMITS = {
    brand: { min: 1, max: 80 },
    model: { min: 1, max: 80 },
    variant: { min: 1, max: 40 },
    nominal_diameter_m: { min: 0.03, max: 1.5 },
    depth_m: { min: 0.02, max: 1 },
} as const;

// Dois itens são o mesmo alto-falante quando marca, modelo e variação coincidem, sem diferenciar
// maiúsculas de minúsculas.
export function identityOf({
    brand,
    model,
    variant,
}: Pick<SavedDriverDraft, 'brand' | 'model' | 'variant'>): string {
    return [brand, model, variant ?? '']
        .map((part) => part.trim().toLowerCase())
        .join('\u0000');
}
