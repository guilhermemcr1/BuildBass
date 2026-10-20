import type { QuantityId } from '@/lib/units/quantities';

// Definições dos parâmetros editáveis na bancada (data-model.md). As chaves seguem o SI e serão
// as mesmas do arquivo de projeto. Faixas: limites físicos largos (research.md §6), não a checagem
// de consistência entre parâmetros, que é da feature 002.

export type ParameterKey =
    | 'fs_hz'
    | 'qts'
    | 'qes'
    | 'qms'
    | 'vas_m3'
    | 're_ohm'
    | 'le_h'
    | 'xmax_m'
    | 'sd_m2'
    | 'pe_w'
    | 'bl_tm'
    | 'mms_kg'
    | 'vb_m3'
    | 'fb_hz';

export type ParameterGroup = 'driver' | 'box';

export type ParameterDefinition = {
    key: ParameterKey;
    symbol: string;
    quantity: QuantityId;
    group: ParameterGroup;
    min: number;
    max: number;
};

function parameter(
    key: ParameterKey,
    symbol: string,
    quantity: QuantityId,
    group: ParameterGroup,
    min: number,
    max: number,
): ParameterDefinition {
    return { key, symbol, quantity, group, min, max };
}

export const PARAMETERS: Record<ParameterKey, ParameterDefinition> = {
    fs_hz: parameter('fs_hz', 'Fs', 'frequency', 'driver', 1, 20_000),
    qts: parameter('qts', 'Qts', 'ratio', 'driver', 0.05, 10),
    qes: parameter('qes', 'Qes', 'ratio', 'driver', 0.05, 10),
    qms: parameter('qms', 'Qms', 'ratio', 'driver', 0.1, 100),
    vas_m3: parameter('vas_m3', 'Vas', 'volume', 'driver', 1e-6, 10),
    re_ohm: parameter('re_ohm', 'Re', 'resistance', 'driver', 0.1, 100),
    le_h: parameter('le_h', 'Le', 'inductance', 'driver', 0, 0.1),
    xmax_m: parameter('xmax_m', 'Xmax', 'length', 'driver', 0, 0.1),
    sd_m2: parameter('sd_m2', 'Sd', 'area', 'driver', 1e-4, 2),
    pe_w: parameter('pe_w', 'Pe', 'power', 'driver', 0.1, 50_000),
    bl_tm: parameter('bl_tm', 'BL', 'forceFactor', 'driver', 0.1, 100),
    mms_kg: parameter('mms_kg', 'Mms', 'mass', 'driver', 1e-4, 5),
    vb_m3: parameter('vb_m3', 'Vb', 'volume', 'box', 1e-4, 20),
    fb_hz: parameter('fb_hz', 'Fb', 'frequency', 'box', 5, 500),
};

export const DRIVER_PARAMETERS: ParameterKey[] = [
    'fs_hz',
    'qts',
    'qes',
    'qms',
    'vas_m3',
    're_ohm',
    'le_h',
    'xmax_m',
    'sd_m2',
    'pe_w',
    'bl_tm',
    'mms_kg',
];

export function withinRange(key: ParameterKey, si: number): boolean {
    const { min, max } = PARAMETERS[key];

    return Number.isFinite(si) && si >= min && si <= max;
}
