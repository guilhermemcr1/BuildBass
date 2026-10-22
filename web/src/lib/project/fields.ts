import { DEFAULT_KERF_M, resolveCutPlan } from '@/cutplan';
import type { CutPlanConfig, CutPlanProportion, SheetConfig } from '@/cutplan';
import { DRIVER_KEYS } from '@/engine';
import type { ParameterKey } from '@/lib/parameters';
import type { DriverKey, PortInput, ProjectData } from './types';

// Onde cada campo da bancada mora dentro do projeto (data-model.md).
type PortKey = 'diameter_m' | 'width_m' | 'height_m' | 'base_m';

const BOX_KEYS = new Set<ParameterKey>([
    'vb_m3',
    'vr_m3',
    'vf_m3',
    'fb_hz',
    'fb_rear_hz',
    'ql',
]);
const PLAN_KEYS = new Set<ParameterKey>([
    'thickness_m',
    'braces_m3',
    'cutout_m',
    'ratio_h',
    'ratio_w',
    'ratio_d',
    'sheet_w_m',
    'sheet_h_m',
    'kerf_m',
]);
const PORT_KEYS = new Set<ParameterKey>([
    'diameter_m',
    'width_m',
    'height_m',
    'base_m',
]);
// Medidas do duto da câmara traseira (bandpass de 6ª ordem), guardadas em `box.port_rear` com os
// mesmos nomes do duto frontal.
const REAR_PORT_KEYS: Partial<Record<ParameterKey, PortKey>> = {
    rear_diameter_m: 'diameter_m',
    rear_width_m: 'width_m',
    rear_height_m: 'height_m',
    rear_base_m: 'base_m',
};
const EMPTY_PORT: PortInput = { shape: 'round', count: 1 };

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
        case 'sheet_w_m':
            return data.cutPlan?.sheet?.w_m;
        case 'sheet_h_m':
            return data.cutPlan?.sheet?.h_m;
        case 'kerf_m':
            return data.cutPlan?.sheet?.kerf_m ?? DEFAULT_KERF_M;
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
        return data.box[
            key as 'vb_m3' | 'vr_m3' | 'vf_m3' | 'fb_hz' | 'fb_rear_hz' | 'ql'
        ];
    }

    if (PLAN_KEYS.has(key)) {
        return readPlanField(data, key);
    }

    if (PORT_KEYS.has(key)) {
        return (data.box.port as Partial<Record<PortKey, number>>)[
            key as PortKey
        ];
    }

    const rearKey = REAR_PORT_KEYS[key];

    if (rearKey !== undefined) {
        return (
            (data.box.port_rear ?? EMPTY_PORT) as Partial<
                Record<PortKey, number>
            >
        )[rearKey];
    }

    switch (key) {
        case 'port_count':
            return data.box.port.count;
        case 'rear_port_count':
            return (data.box.port_rear ?? EMPTY_PORT).count;
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
const SHEET_FIELD = {
    sheet_w_m: 'w_m',
    sheet_h_m: 'h_m',
    kerf_m: 'kerf_m',
} as const;

// A chapa some do projeto quando largura e altura ficam vazias (sobrariam só a perda de serra e a
// rotação, que sem chapa não significam nada).
function withSheet(data: ProjectData, sheet: SheetConfig): ProjectData {
    const current = data.cutPlan ?? {};

    if (sheet.w_m === undefined && sheet.h_m === undefined) {
        return withCutPlan(data, without(current, 'sheet'));
    }

    return withCutPlan(data, { ...current, sheet });
}

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

    if (key === 'sheet_w_m' || key === 'sheet_h_m' || key === 'kerf_m') {
        return withSheet(
            data,
            withField(current.sheet ?? {}, SHEET_FIELD[key], si),
        );
    }

    return withCutPlan(data, withField(current, key, si));
}

// "Pode girar as peças": só vale com a chapa começada.
export function writeSheetRotate(
    data: ProjectData,
    rotate: boolean,
): ProjectData {
    const sheet = data.cutPlan?.sheet;

    return sheet === undefined ? data : withSheet(data, { ...sheet, rotate });
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

    const rearKey = REAR_PORT_KEYS[key];

    if (rearKey !== undefined) {
        const rear = data.box.port_rear ?? EMPTY_PORT;

        return {
            ...data,
            box: { ...data.box, port_rear: withField(rear, rearKey, si) },
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
        case 'rear_port_count':
            return {
                ...data,
                box: {
                    ...data.box,
                    port_rear: {
                        ...(data.box.port_rear ?? EMPTY_PORT),
                        count: si ?? 1,
                    },
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
