import { z } from 'zod';
import { PARAMETERS } from '@/lib/parameters';
import {
    DRIVER_PISTONS,
    DRIVER_SHAPES,
    DRIVER_TYPES,
} from '@/lib/project/types';
import type { ParameterKey } from '@/lib/parameters';

// Resposta da API do catálogo (contracts/catalog-api.md). A resposta é entrada não confiável
// (constituição, princípio IV): só chega ao projeto depois de passar por aqui. As faixas vêm de
// PARAMETERS, as mesmas da digitação manual (FR-009). Carregado sob demanda pelo cliente.

function range(key: ParameterKey) {
    const { min, max } = PARAMETERS[key];

    return z.number().min(min).max(max);
}

// URL de imagem vinda da API: só http(s), nunca javascript: nem data: (entrada não confiável).
const imageUrl = z.url({ protocol: /^https?$/ });

const summary = z.object({
    id: z.uuid(),
    brand: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(80),
    variant: z.string().trim().min(1).max(40).nullable(),
    type: z.enum(DRIVER_TYPES).optional(),
    nominal_diameter_m: z.number().min(0.03).max(1.5).optional(),
    fs_hz: range('fs_hz'),
    qts: range('qts'),
    vas_m3: range('vas_m3'),
    cover_thumb_url: imageUrl.optional(),
});

const driver = summary.extend({
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
    // Medidas físicas (opcionais): formato, pistão e as cotas A–G, com as faixas da bancada.
    drv_shape: z.enum(DRIVER_SHAPES).optional(),
    drv_piston: z.enum(DRIVER_PISTONS).optional(),
    drv_a_m: range('drv_a_m').optional(),
    drv_b_m: range('drv_b_m').optional(),
    cutout_m: range('cutout_m').optional(),
    drv_d_m: range('drv_d_m').optional(),
    drv_e_m: range('drv_e_m').optional(),
    drv_f_m: range('drv_f_m').optional(),
    drv_g_m: range('drv_g_m').optional(),
    source: z.string().max(255),
    images: z
        .array(z.object({ url: imageUrl, thumb_url: imageUrl }))
        .max(5)
        .default([]),
});

export const searchResponseSchema = z.object({
    data: z.array(summary),
    meta: z.object({
        limit: z.number().int().min(1),
        has_more: z.boolean(),
    }),
});

export const driverResponseSchema = z.object({ data: driver });

export const brandsResponseSchema = z.object({
    data: z.array(z.string().trim().min(1).max(80)).max(500),
});
