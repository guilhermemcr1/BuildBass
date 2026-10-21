import { resolveCutPlan } from '@/cutplan';
import type { CutPlanConfig, CutPlanProportion } from '@/cutplan';
import { DRIVER_KEYS } from '@/engine';
import type { ParameterKey } from '@/lib/parameters';
import type { DriverKey, ProjectData } from './types';

// Onde cada campo da bancada mora dentro do projeto (data-model.md).
type PortKey = 'diameter_m' | 'width_m' | 'height_m' | 'base_m';

const BOX_KEYS = new Set<ParameterKey>([
    'vb_m3',
    'vr_m3',
    'vf_m3',
    'fb_hz',
    'ql',
]);
const PLAN_KEYS = new Set<ParameterKey>([
    'thickness_m',
    'braces_m3',
    'cutout_m',
    'ratio_h',
    'ratio_w',
    'ratio_d',
]);
const PORT_KEYS = new Set<ParameterKey>([
    'diameter_m',
    'width_m',
    'height_m',
    'base_m',
]);

function driverKey(key: ParameterKey): key is DriverKey {
    return (DRIVER_KEYS as ParameterKey[]).includes(key);
}

function readPlanField(
    data: ProjectData,
    key: ParameterKey,
): number | undefined {
    const config = resolveCutPlan(data.cutPlan);

    switch (key) {
        case 'thickness_m':
            return config.thickness_m;
        case 'braces_m3':
            return config.braces_m3;
        case 'cutout_m':
            return config.cutout_m;
        case 'ratio_h':
            return config.ratio.h;
        case 'ratio_w':
            return config.ratio.w;
        case 'ratio_d':
            return config.ratio.d;
        default:
            return undefined;
    }
}

export function readField(
    data: ProjectData,
    key: ParameterKey,
): number | undefined {
    if (driverKey(key)) {
        return data.driver[key];
    }

    if (BOX_KEYS.has(key)) {
        return data.box[key as 'vb_m3' | 'vr_m3' | 'vf_m3' | 'fb_hz' | 'ql'];
    }

    if (PLAN_KEYS.has(key)) {
        return readPlanField(data, key);
    }

    if (PORT_KEYS.has(key)) {
        return (data.box.port as Partial<Record<PortKey, number>>)[
            key as PortKey
        ];
    }

    switch (key) {
        case 'port_count':
            return data.box.port.count;
        case 'driver_count':
            return data.drivers.count;
        case 'power_w':
            return data.signal.power_w;
        case 'voltage_v':
            return data.signal.voltage_v;
        default:
            return undefined;
    }
}

function without<T extends object>(record: T, key: string): T {
    const next = { ...record } as Record<string, unknown>;
    delete next[key];

    return next as T;
}

function withField<T extends object>(
    record: T,
    key: string,
    si: number | undefined,
): T {
    return si === undefined ? without(record, key) : { ...record, [key]: si };
}

// Um cutPlan vazio não existe: o projeto volta a ser igual ao de antes de mexer no plano.
function withCutPlan(data: ProjectData, cutPlan: CutPlanConfig): ProjectData {
    if (Object.keys(cutPlan).length === 0) {
        return without(data, 'cutPlan');
    }

    return { ...data, cutPlan };
}

const RATIO_SIDE = { ratio_h: 'h', ratio_w: 'w', ratio_d: 'd' } as const;

function writePlanField(
    data: ProjectData,
    key: ParameterKey,
    si: number | undefined,
): ProjectData {
    const current = data.cutPlan ?? {};

    if (key === 'ratio_h' || key === 'ratio_w' || key === 'ratio_d') {
        // Esvaziar um lado da razão não tem significado: o campo volta ao valor atual.
        if (si === undefined) {
            return data;
        }

        const custom = {
            ...resolveCutPlan(current).ratio,
            [RATIO_SIDE[key]]: si,
        };

        return withCutPlan(data, { ...current, proportion: 'custom', custom });
    }

    return withCutPlan(data, withField(current, key, si));
}

// Escolhe a proporção; "própria" parte da razão que estava ativa, para a caixa não pular.
export function writeProportion(
    data: ProjectData,
    proportion: CutPlanProportion,
): ProjectData {
    const current = data.cutPlan ?? {};

    if (proportion === 'custom') {
        return withCutPlan(data, {
            ...current,
            proportion,
            custom: resolveCutPlan(current).ratio,
        });
    }

    return withCutPlan(data, { ...current, proportion });
}

// A origem copiada do catálogo some quando o driver fica sem nenhum valor (specs/003, FR-010).
export function withDriver(
    data: ProjectData,
    driver: ProjectData['driver'],
): ProjectData {
    if (Object.keys(driver).length > 0) {
        return { ...data, driver };
    }

    return { ...without(data, 'driverSource'), driver };
}

// Devolve o projeto com o campo alterado; `undefined` apaga o valor digitado.
export function writeField(
    data: ProjectData,
    key: ParameterKey,
    si: number | undefined,
): ProjectData {
    if (driverKey(key)) {
        return withDriver(data, withField(data.driver, key, si));
    }

    if (key === 'ql') {
        return { ...data, box: { ...data.box, ql: si ?? 7 } };
    }

    if (BOX_KEYS.has(key)) {
        return { ...data, box: withField(data.box, key, si) };
    }

    if (PLAN_KEYS.has(key)) {
        return writePlanField(data, key, si);
    }

    if (PORT_KEYS.has(key)) {
        return {
            ...data,
            box: { ...data.box, port: withField(data.box.port, key, si) },
        };
    }

    switch (key) {
        case 'port_count':
            return {
                ...data,
                box: {
                    ...data.box,
                    port: { ...data.box.port, count: si ?? 1 },
                },
            };
        case 'driver_count':
            return { ...data, drivers: { ...data.drivers, count: si ?? 1 } };
        case 'power_w':
        case 'voltage_v':
            return { ...data, signal: withField(data.signal, key, si) };
        default:
            return data;
    }
}
