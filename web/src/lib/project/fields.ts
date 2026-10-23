import { CUT_PLAN_LIMITS, DEFAULT_KERF_M, resolveCutPlan } from '@/cutplan';
import type { CutPlanConfig, CutPlanProportion, SheetConfig } from '@/cutplan';
import { DRIVER_KEYS } from '@/engine';
import type { CatalogDims } from '@/lib/catalog/to-driver-input';
import type { ParameterKey } from '@/lib/parameters';
import type {
    DriverDims,
    DriverKey,
    DriverSource,
    PortInput,
    ProjectData,
} from './types';

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
// Medidas físicas do alto-falante: campo da bancada → chave em `driverDims`.
const DIMS_KEYS = {
    drv_a_m: 'a_m',
    drv_b_m: 'b_m',
    drv_d_m: 'd_m',
    drv_e_m: 'e_m',
    drv_f_m: 'f_m',
    drv_g_m: 'g_m',
} as const;
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

    if (key in DIMS_KEYS) {
        return data.driverDims?.[DIMS_KEYS[key as keyof typeof DIMS_KEYS]];
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
    value: unknown,
): T {
    return value === undefined
        ? without(record, key)
        : { ...record, [key]: value };
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

type Axis = 'h' | 'w' | 'd';

// Define uma medida interna da caixa e ajusta as outras duas para o volume continuar o mesmo: as
// duas ficam na razão que tinham e dividem a diferença. Guarda o resultado como proporção "própria"
// (normalizada pela profundidade). Medida que levaria a razão para fora da faixa não entra.
export function writeDimension(
    data: ProjectData,
    internal: { h_m: number; w_m: number; d_m: number },
    axis: Axis,
    si: number,
): ProjectData {
    const old = internal[`${axis}_m` as 'h_m' | 'w_m' | 'd_m'];
    const others = Math.sqrt(old / si);
    const next = {
        h: axis === 'h' ? si : internal.h_m * others,
        w: axis === 'w' ? si : internal.w_m * others,
        d: axis === 'd' ? si : internal.d_m * others,
    };
    const custom = { h: next.h / next.d, w: next.w / next.d, d: 1 };
    const { min, max } = CUT_PLAN_LIMITS.ratio;

    if (
        [custom.h, custom.w, custom.d].some((side) => side < min || side > max)
    ) {
        return data;
    }

    return withCutPlan(data, {
        ...data.cutPlan,
        proportion: 'custom',
        custom,
    });
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

// Sem nenhuma medida nem formato, `driverDims` não existe: o projeto volta a ser o de antes.
export function withDriverDims(
    data: ProjectData,
    driverDims: DriverDims,
): ProjectData {
    return Object.keys(driverDims).length === 0
        ? without(data, 'driverDims')
        : { ...data, driverDims };
}

// Formato do alto-falante e tipo de pistão (listas, não números).
export function writeDriverChoice(
    data: ProjectData,
    key: 'shape' | 'piston',
    value: DriverDims['shape'] | DriverDims['piston'] | undefined,
): ProjectData {
    return withDriverDims(data, withField(data.driverDims ?? {}, key, value));
}

// Medidas físicas vindas do catálogo: substituem as do projeto por inteiro (formato, pistão e
// cotas A–G; o recorte C mora no plano de corte), para não sobrar cota de outro alto-falante.
export function applyCatalogDims(
    data: ProjectData,
    dims: CatalogDims,
): ProjectData {
    let next = withDriverDims(data, {});

    if (dims.shape !== undefined) {
        next = writeDriverChoice(next, 'shape', dims.shape);
    }

    if (dims.piston !== undefined) {
        next = writeDriverChoice(next, 'piston', dims.piston);
    }

    for (const [key, si] of Object.entries(dims.measures)) {
        next = writeField(next, key as ParameterKey, si);
    }

    return next;
}

// A identificação (marca, modelo, tipo) é um dado do projeto, editável à mão: ela fica mesmo com o
// driver sem valores, e só o usuário a apaga.
export function withDriver(
    data: ProjectData,
    driver: ProjectData['driver'],
): ProjectData {
    return { ...data, driver };
}

// Aplica uma mudança na identificação do driver: texto vazio (depois de aparar) ou `undefined`
// apaga a parte; sem nenhuma parte sobrando, a identificação some do projeto.
export function withIdentity(
    data: ProjectData,
    patch: Partial<DriverSource>,
): ProjectData {
    const next: Record<string, unknown> = { ...data.driverSource, ...patch };

    for (const [key, value] of Object.entries(next)) {
        if (
            value === undefined ||
            (typeof value === 'string' && value.trim() === '')
        ) {
            delete next[key];
        }
    }

    return Object.keys(next).length === 0
        ? without(data, 'driverSource')
        : { ...data, driverSource: next as DriverSource };
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

    if (key in DIMS_KEYS) {
        return withDriverDims(
            data,
            withField(
                data.driverDims ?? {},
                DIMS_KEYS[key as keyof typeof DIMS_KEYS],
                si,
            ),
        );
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
