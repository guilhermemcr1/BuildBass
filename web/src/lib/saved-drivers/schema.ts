import { z } from 'zod';
import { CUT_PLAN_LIMITS } from '@/cutplan/config';
import { driverSchema } from '@/lib/project/schema';
import { SAVED_DRIVER_LIMITS, SAVED_DRIVERS_MAX } from './types';
import type { SavedDriverDraft } from './types';

// Esquema do arquivo .buildbass-drivers.json (specs/008, contracts/drivers-file.md). Carregado
// sob demanda: o Zod só entra quando o usuário importa um arquivo.

function span(limit: { min: number; max: number }) {
    return z.number().min(limit.min).max(limit.max);
}

const item = z.object({
    brand: z
        .string()
        .trim()
        .min(SAVED_DRIVER_LIMITS.brand.min)
        .max(SAVED_DRIVER_LIMITS.brand.max),
    model: z
        .string()
        .trim()
        .min(SAVED_DRIVER_LIMITS.model.min)
        .max(SAVED_DRIVER_LIMITS.model.max),
    variant: z
        .string()
        .trim()
        .min(SAVED_DRIVER_LIMITS.variant.min)
        .max(SAVED_DRIVER_LIMITS.variant.max)
        .optional(),
    driver: driverSchema,
    nominal_diameter_m: span(SAVED_DRIVER_LIMITS.nominal_diameter_m).optional(),
    cutout_m: span(CUT_PLAN_LIMITS.cutout_m).optional(),
    depth_m: span(SAVED_DRIVER_LIMITS.depth_m).optional(),
});

export const savedDriversSchema = z.object({
    drivers: z.array(item).max(SAVED_DRIVERS_MAX),
}) satisfies z.ZodType<{ drivers: SavedDriverDraft[] }, unknown>;
