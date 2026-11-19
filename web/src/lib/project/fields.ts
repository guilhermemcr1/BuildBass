import {
    CUT_PLAN_LIMITS,
    DEFAULT_KERF_M,
    resolveCutPlan,
    withStock,
} from '@/cutplan';
import type {
    CutMode,
    CutoutPiece,
    CutoutRef,
    CutPlanConfig,
    CutPlanProportion,
    SheetConfig,
    StockItem,
} from '@/cutplan';
import { DRIVER_KEYS, twoChambers } from '@/engine';
import type { CatalogDims } from '@/lib/catalog/to-driver-input';
import type { ParameterKey } from '@/lib/parameters';
import type {
    DriverDims,
    DriverKey,
    DriverSource,
    PortInput,
    ProjectData,
} from './types';

// Onde cada campo da bancada mora dentro do projeto.
type PortKey = 'diameter_m' | 'width_m' | 'height_m' | 'base_m' | 'length_m';

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
// A profundidade é guardada no duto como `length_m`.
const PORT_LENGTH_KEYS: Partial<Record<ParameterKey, 'front' | 'rear'>> = {
    port_length_m: 'front',
    rear_port_length_m: 'rear',
};
// Medidas do duto da câmara traseira (bandpass de 6ª ordem), guardadas em `box.port_rear` com os
// mesmos nomes do duto frontal.
const REAR_PORT_KEYS: Partial<Record<ParameterKey, PortKey>> = {
    rear_diameter_m: 'diameter_m',
    rear_width_m: 'width_m',
    rear_height_m: 'height_m',
    rear_base_m: 'base_m',
    rear_port_length_m: 'length_m',
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

    if (PORT_LENGTH_KEYS[key] === 'front') {
        return data.box.port.length_m;
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
        case 'end_k':
            return data.box.port.end_k;
        case 'rear_end_k':
            return data.box.port_rear?.end_k;
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

// A chapa some do projeto quando largura e altura ficam vazias e não há outro item no estoque
// (sobrariam só a perda de serra, a rotação e o tipo de corte, que sem chapa não significam nada).
function withSheet(
    data: ProjectData,
    sheet: SheetConfig | undefined,
): ProjectData {
    const current = data.cutPlan ?? {};

    if (
        sheet === undefined ||
        (sheet.w_m === undefined &&
            sheet.h_m === undefined &&
            sheet.more === undefined)
    ) {
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

// Estoque de chapas: grava a lista inteira de uma vez (adicionar, editar, remover e
// reordenar são todas trocas da lista), preservando perda de serra, rotação e tipo de corte.
export function setStock(data: ProjectData, items: StockItem[]): ProjectData {
    return withSheet(data, withStock(data.cutPlan?.sheet, items));
}

// "Serra" é o padrão e não fica gravado: o arquivo só muda de versão por "CNC/tupia".
export function setCutMode(data: ProjectData, cut: CutMode): ProjectData {
    const sheet = data.cutPlan?.sheet;

    if (sheet === undefined) {
        return data;
    }

    return withSheet(
        data,
        withField(sheet, 'cut', cut === 'guillotine' ? undefined : cut),
    );
}

const sameRef = (a: CutoutRef, b: CutoutRef) =>
    a.piece === b.piece && a.kind === b.kind && a.n === b.n;

function withPositions(
    data: ProjectData,
    positions: NonNullable<CutPlanConfig['positions']>,
): ProjectData {
    const current = data.cutPlan ?? {};

    return withCutPlan(
        data,
        withField(
            current,
            'positions',
            positions.length === 0 ? undefined : positions,
        ),
    );
}

// Centro de um recorte, da borda esquerda e de baixo da peça; limitado às faixas do arquivo.
export function setCutoutPosition(
    data: ProjectData,
    ref: CutoutRef,
    x_m: number,
    y_m: number,
): ProjectData {
    const clamp = (value: number, key: 'cutpos_x_m' | 'cutpos_y_m') =>
        Math.min(
            CUT_PLAN_LIMITS[key].max,
            Math.max(CUT_PLAN_LIMITS[key].min, value),
        );
    const others = (data.cutPlan?.positions ?? []).filter(
        (item) => !sameRef(item, ref),
    );

    return withPositions(data, [
        ...others,
        {
            piece: ref.piece,
            kind: ref.kind,
            n: ref.n,
            x_m: clamp(x_m, 'cutpos_x_m'),
            y_m: clamp(y_m, 'cutpos_y_m'),
        },
    ]);
}

export function clearCutoutPosition(
    data: ProjectData,
    ref: CutoutRef,
): ProjectData {
    const positions = data.cutPlan?.positions;

    if (positions === undefined) {
        return data;
    }

    return withPositions(
        data,
        positions.filter((item) => !sameRef(item, ref)),
    );
}

export function clearPiecePositions(
    data: ProjectData,
    piece: CutoutPiece,
): ProjectData {
    const positions = data.cutPlan?.positions;

    if (positions === undefined) {
        return data;
    }

    return withPositions(
        data,
        positions.filter((item) => item.piece !== piece),
    );
}

// Tira as posições manuais dos dutos de uma peça: eles voltam a seguir a posição escolhida.
export function clearPortPositions(
    data: ProjectData,
    piece: CutoutPiece,
): ProjectData {
    const positions = data.cutPlan?.positions;

    if (positions === undefined) {
        return data;
    }

    return withPositions(
        data,
        positions.filter(
            (item) => !(item.piece === piece && item.kind === 'port'),
        ),
    );
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
    // Com o volume solto, só a medida editada muda e o Vb acompanha a caixa.
    if (data.cutPlan?.lockVolume === false) {
        return writeDimensionFree(data, internal, axis, si);
    }

    const old = internal[`${axis}_m` as 'h_m' | 'w_m' | 'd_m'];
    const others = Math.sqrt(old / si);
    const next = {
        h: axis === 'h' ? si : internal.h_m * others,
        w: axis === 'w' ? si : internal.w_m * others,
        d: axis === 'd' ? si : internal.d_m * others,
    };

    return withRatio(data, next);
}

function withRatio(
    data: ProjectData,
    next: { h: number; w: number; d: number },
): ProjectData {
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

// Volume solto: as outras duas medidas ficam; o volume interno novo, menos os reforços, vira o Vb
// (na bandpass, as duas câmaras mudam na mesma proporção).
function writeDimensionFree(
    data: ProjectData,
    internal: { h_m: number; w_m: number; d_m: number },
    axis: Axis,
    si: number,
): ProjectData {
    const next = {
        h: axis === 'h' ? si : internal.h_m,
        w: axis === 'w' ? si : internal.w_m,
        d: axis === 'd' ? si : internal.d_m,
    };
    const braces = resolveCutPlan(data.cutPlan).braces_m3;
    const total = next.h * next.w * next.d - braces;
    const shaped = withRatio(data, next);

    if (shaped === data || !(total > 0)) {
        return data;
    }

    const { box } = shaped;

    if (twoChambers(box.type)) {
        const rear = box.vr_m3 ?? 0;
        const front = box.vf_m3 ?? 0;
        const factor = total / (rear + front);

        return {
            ...shaped,
            box: { ...box, vr_m3: rear * factor, vf_m3: front * factor },
        };
    }

    return { ...shaped, box: { ...box, vb_m3: total } };
}

// Assistente: a pessoa diz as três medidas internas de uma vez (já sem a espessura). A proporção
// passa a ser a delas e o volume interno, menos os reforços, vira o Vb, como no volume solto.
// Só para caixa de uma câmara; medida fora da faixa de proporção não entra.
export function writeInternalSize(
    data: ProjectData,
    size: { h_m: number; w_m: number; d_m: number },
): ProjectData {
    const braces = resolveCutPlan(data.cutPlan).braces_m3;
    const total = size.h_m * size.w_m * size.d_m - braces;
    const shaped = withRatio(data, { h: size.h_m, w: size.w_m, d: size.d_m });

    if (shaped === data || !(total > 0) || twoChambers(data.box.type)) {
        return data;
    }

    return { ...shaped, box: { ...shaped.box, vb_m3: total } };
}

export function writeLockVolume(data: ProjectData, lock: boolean): ProjectData {
    const { lockVolume: _old, ...rest } = data.cutPlan ?? {};

    return withCutPlan(data, lock ? rest : { ...rest, lockVolume: false });
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
// Troca de alto-falante: tudo o que é do driver anterior sai (formato, pistão, cotas A–G, o recorte
// do plano de corte e a ligação das bobinas). O que o novo não trouxer fica em branco, nunca herdado.
export function clearDriverSpecifics(data: ProjectData): ProjectData {
    const { coil_wiring: _coilWiring, ...drivers } = data.drivers;

    return writeField(
        withDriverDims({ ...data, drivers }, {}),
        'cutout_m',
        undefined,
    );
}

export function applyCatalogDims(
    data: ProjectData,
    dims: CatalogDims,
): ProjectData {
    let next = clearDriverSpecifics(data);

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

    if (PORT_LENGTH_KEYS[key] === 'front') {
        return {
            ...data,
            box: {
                ...data.box,
                port: withField(data.box.port, 'length_m', si),
            },
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
        case 'end_k':
            return {
                ...data,
                box: {
                    ...data.box,
                    port: withField(data.box.port, 'end_k', si),
                },
            };
        case 'rear_end_k':
            return {
                ...data,
                box: {
                    ...data.box,
                    port_rear: withField(
                        data.box.port_rear ?? EMPTY_PORT,
                        'end_k',
                        si,
                    ),
                },
            };
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
