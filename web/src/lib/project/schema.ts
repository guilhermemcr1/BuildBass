import { z } from 'zod';
import { MAX_STOCK_ITEMS } from '@/cutplan/stock';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { QUANTITIES } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { DRIVER_TYPES, PROJECT_NAME_MAX } from './types';
import type { ProjectData } from './types';

// Schema do projeto na versão 1. As faixas vêm de PARAMETERS, as
// mesmas de data-model.md. Carregado sob demanda: o Zod só entra quando se abre um arquivo.

function range(key: ParameterKey) {
    const { min, max } = PARAMETERS[key];

    return z.number().min(min).max(max);
}

const count = z.number().int().min(1).max(8);

export const driverSchema = z.object({
    fs_hz: range('fs_hz').optional(),
    qts: range('qts').optional(),
    qes: range('qes').optional(),
    qms: range('qms').optional(),
    vas_m3: range('vas_m3').optional(),
    re_ohm: range('re_ohm').optional(),
    le_h: range('le_h').optional(),
    le10k_h: range('le10k_h').optional(),
    xmax_m: range('xmax_m').optional(),
    sd_m2: range('sd_m2').optional(),
    pe_w: range('pe_w').optional(),
    bl_tm: range('bl_tm').optional(),
    mms_kg: range('mms_kg').optional(),
    vd_m3: range('vd_m3').optional(),
});

// Correção de ponta (versão 8): opcional, ausente = flangeada + livre.
const ends = {
    end: z
        .enum(['flangedFree', 'free', 'flanged', 'slotWall', 'custom'])
        .optional(),
    end_k: range('end_k').optional(),
    length_m: range('port_length_m').optional(),
    mount: z.enum(['corners', 'free']).optional(),
    placement: z
        .enum([
            'auto',
            'bottom',
            'top',
            'left',
            'right',
            'bottomLeft',
            'bottomRight',
            'topLeft',
            'topRight',
        ])
        .optional(),
    rotation: z
        .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
        .optional(),
    against_wall: z.boolean().optional(),
};

const port = z.discriminatedUnion('shape', [
    z.object({
        shape: z.literal('round'),
        diameter_m: range('diameter_m').optional(),
        count,
        ...ends,
    }),
    z.object({
        shape: z.literal('rect'),
        width_m: range('width_m').optional(),
        height_m: range('height_m').optional(),
        count,
        ...ends,
    }),
    z.object({
        shape: z.literal('triangle'),
        base_m: range('base_m').optional(),
        height_m: range('height_m').optional(),
        count,
        ...ends,
    }),
]);

// Unidade por campo: entradas desconhecidas ou de outra grandeza são descartadas, sem recusar
// o arquivo.
const fieldUnits = z.record(z.string(), z.unknown()).transform((entries) => {
    const valid: Partial<Record<ParameterKey, UnitId>> = {};

    for (const [key, unit] of Object.entries(entries)) {
        const parameter = PARAMETERS[key as ParameterKey] as
            | (typeof PARAMETERS)[ParameterKey]
            | undefined;

        if (
            parameter !== undefined &&
            QUANTITIES[parameter.quantity].units.some(
                (item) => item.id === unit,
            )
        ) {
            valid[key as ParameterKey] = unit as UnitId;
        }
    }

    return valid;
});

// Identificação do driver (opcional: arquivos anteriores à feature 003 não têm; o tipo veio depois
// e, sendo opcional, não muda a versão do arquivo).
const driverSource = z.object({
    brand: z.string().trim().min(1).max(80).optional(),
    model: z.string().trim().min(1).max(80).optional(),
    variant: z.string().trim().min(1).max(40).optional(),
    type: z.enum(DRIVER_TYPES).optional(),
});

// Configuração do plano de corte (opcional: só existe depois que o usuário edita um campo do plano).
// Campos desconhecidos são ignorados; `custom` com outra proporção é aceito e não é usado.
const ratioRange = range('ratio_h');
const sheetQuantity = range('sheet_quantity').int();
const cutPlan = z.object({
    thickness_m: range('thickness_m').optional(),
    proportion: z
        .enum(['golden', 'louden', 'equalSteps', 'cube', 'custom'])
        .optional(),
    custom: z
        .object({ h: ratioRange, w: ratioRange, d: ratioRange })
        .optional(),
    braces_m3: range('braces_m3').optional(),
    cutout_m: range('cutout_m').optional(),
    lockVolume: z.boolean().optional(),
    // Chapa que o usuário tem (versão 5): largura e altura obrigatórias dentro do objeto. A versão 7
    // acrescenta o estoque (quantidade, demais itens) e o tipo de corte.
    sheet: z
        .object({
            w_m: range('sheet_w_m'),
            h_m: range('sheet_h_m'),
            kerf_m: range('kerf_m').optional(),
            rotate: z.boolean().optional(),
            quantity: sheetQuantity.optional(),
            more: z
                .array(
                    z.object({
                        w_m: range('sheet_w_m'),
                        h_m: range('sheet_h_m'),
                        quantity: sheetQuantity.optional(),
                    }),
                )
                .max(MAX_STOCK_ITEMS - 1)
                .optional(),
            cut: z.enum(['guillotine', 'free']).optional(),
        })
        .optional(),
    // Centros dos recortes movidos pelo usuário (versão 7).
    positions: z
        .array(
            z.object({
                piece: z.enum(['front', 'back', 'divider']),
                kind: z.enum(['driver', 'port']),
                n: z.number().int().min(1).max(16),
                x_m: range('cutpos_x_m'),
                y_m: range('cutpos_y_m'),
            }),
        )
        .max(32)
        .optional(),
});

// Medidas físicas do alto-falante (versão 6): tudo opcional, faixas de PARAMETERS.
const driverDims = z.object({
    shape: z.enum(['round', 'square', 'rect']).optional(),
    piston: z.enum(['cone', 'dome', 'flat']).optional(),
    a_m: range('drv_a_m').optional(),
    b_m: range('drv_b_m').optional(),
    d_m: range('drv_d_m').optional(),
    e_m: range('drv_e_m').optional(),
    f_m: range('drv_f_m').optional(),
    g_m: range('drv_g_m').optional(),
});

export const projectSchema = z.object({
    // Vazio = nome padrão traduzido (lib/project/names.ts).
    name: z.string().trim().max(PROJECT_NAME_MAX),
    driver: driverSchema,
    driverSource: driverSource.optional(),
    driverDims: driverDims.optional(),
    drivers: z.object({
        count,
        wiring: z.enum(['series', 'parallel']),
        // Ligação das duas bobinas de um driver de bobina dupla; ausente = série.
        coil_wiring: z.enum(['series', 'parallel']).optional(),
    }),
    box: z.object({
        type: z.enum(['closed', 'vented', 'bandpass', 'bandpass6']),
        vb_m3: range('vb_m3').optional(),
        vr_m3: range('vr_m3').optional(),
        vf_m3: range('vf_m3').optional(),
        ql: range('ql'),
        // Material de absorção (versão 8).
        fill: z.enum(['none', 'lined', 'stuffed']).optional(),
        fb_hz: range('fb_hz').optional(),
        fb_rear_hz: range('fb_rear_hz').optional(),
        port,
        port_rear: port.optional(),
    }),
    signal: z.object({
        mode: z.enum(['power', 'voltage']),
        power_w: range('power_w').optional(),
        voltage_v: range('voltage_v').optional(),
        radiation: z.enum(['half', 'full']),
    }),
    cutPlan: cutPlan.optional(),
    fieldUnits: fieldUnits.default({}),
}) satisfies z.ZodType<ProjectData, unknown>;
