import { z } from 'zod';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { QUANTITIES } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { PROJECT_NAME_MAX } from './types';
import type { ProjectData } from './types';

// Schema do projeto na versão 1 (contracts/project-file.md). As faixas vêm de PARAMETERS, as
// mesmas de data-model.md. Carregado sob demanda: o Zod só entra quando se abre um arquivo.

function range(key: ParameterKey) {
    const { min, max } = PARAMETERS[key];

    return z.number().min(min).max(max);
}

const count = z.number().int().min(1).max(8);

const driver = z.object({
    fs_hz: range('fs_hz').optional(),
    qts: range('qts').optional(),
    qes: range('qes').optional(),
    qms: range('qms').optional(),
    vas_m3: range('vas_m3').optional(),
    re_ohm: range('re_ohm').optional(),
    le_h: range('le_h').optional(),
    xmax_m: range('xmax_m').optional(),
    sd_m2: range('sd_m2').optional(),
    pe_w: range('pe_w').optional(),
    bl_tm: range('bl_tm').optional(),
    mms_kg: range('mms_kg').optional(),
    vd_m3: range('vd_m3').optional(),
});

const port = z.discriminatedUnion('shape', [
    z.object({
        shape: z.literal('round'),
        diameter_m: range('diameter_m').optional(),
        count,
    }),
    z.object({
        shape: z.literal('rect'),
        width_m: range('width_m').optional(),
        height_m: range('height_m').optional(),
        count,
    }),
    z.object({
        shape: z.literal('triangle'),
        base_m: range('base_m').optional(),
        height_m: range('height_m').optional(),
        count,
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

// Origem do driver copiado do catálogo (opcional: arquivos anteriores à feature 003 não têm).
const driverSource = z.object({
    brand: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(80),
    variant: z.string().trim().min(1).max(40).optional(),
});

export const projectSchema = z.object({
    // Vazio = nome padrão traduzido (lib/project/names.ts).
    name: z.string().trim().max(PROJECT_NAME_MAX),
    driver,
    driverSource: driverSource.optional(),
    drivers: z.object({
        count,
        wiring: z.enum(['series', 'parallel']),
    }),
    box: z.object({
        type: z.enum(['closed', 'vented', 'bandpass']),
        vb_m3: range('vb_m3').optional(),
        vr_m3: range('vr_m3').optional(),
        vf_m3: range('vf_m3').optional(),
        ql: range('ql'),
        fb_hz: range('fb_hz').optional(),
        port,
    }),
    signal: z.object({
        mode: z.enum(['power', 'voltage']),
        power_w: range('power_w').optional(),
        voltage_v: range('voltage_v').optional(),
        radiation: z.enum(['half', 'full']),
    }),
    fieldUnits: fieldUnits.default({}),
}) satisfies z.ZodType<ProjectData, unknown>;
