import { z } from 'zod';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';

// Resposta da API do catálogo (contracts/catalog-api.md). A resposta é entrada não confiável
// (constituição, princípio IV): só chega ao projeto depois de passar por aqui. As faixas vêm de
// PARAMETERS, as mesmas da digitação manual (FR-009). Carregado sob demanda pelo cliente.

function range(key: ParameterKey) {
    const { min, max } = PARAMETERS[key];

    return z.number().min(min).max(max);
}

const summary = z.object({
    id: z.number().int().min(1),
    brand: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(80),
    variant: z.string().trim().min(1).max(40).nullable(),
    fs_hz: range('fs_hz'),
    qts: range('qts'),
    vas_m3: range('vas_m3'),
});

const driver = summary.extend({
    nominal_diameter_m: z.number().min(0.03).max(1.5).optional(),
    qes: range('qes').optional(),
    qms: range('qms').optional(),
    re_ohm: range('re_ohm').optional(),
    le_h: range('le_h').optional(),
    xmax_m: range('xmax_m').optional(),
    sd_m2: range('sd_m2').optional(),
    pe_w: range('pe_w').optional(),
    bl_tm: range('bl_tm').optional(),
    mms_kg: range('mms_kg').optional(),
    vd_m3: range('vd_m3').optional(),
    source: z.string().max(255),
});

export const searchResponseSchema = z.object({
    data: z.array(summary),
    meta: z.object({
        limit: z.number().int().min(1),
        has_more: z.boolean(),
    }),
});

export const driverResponseSchema = z.object({ data: driver });
