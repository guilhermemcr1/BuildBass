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
    | 'vd_m3'
    | 'vb_m3'
    | 'fb_hz'
    | 'ql'
    | 'diameter_m'
    | 'width_m'
    | 'height_m'
    | 'base_m'
    | 'port_count'
    | 'driver_count'
    | 'power_w'
    | 'voltage_v';

export type ParameterGroup = 'driver' | 'box' | 'port' | 'signal';

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
    vd_m3: parameter('vd_m3', 'Vd', 'volume', 'driver', 0, 0.1),
    fb_hz: parameter('fb_hz', 'Fb', 'frequency', 'box', 5, 500),
    ql: parameter('ql', 'Ql', 'ratio', 'box', 1, 100),
    diameter_m: parameter('diameter_m', 'Ø', 'length', 'port', 0.005, 1),
    width_m: parameter('width_m', 'W', 'length', 'port', 0.005, 2),
    height_m: parameter('height_m', 'H', 'length', 'port', 0.005, 2),
    base_m: parameter('base_m', 'B', 'length', 'port', 0.005, 2),
    port_count: parameter('port_count', 'n', 'count', 'port', 1, 8),
    driver_count: parameter('driver_count', 'N', 'count', 'driver', 1, 8),
    power_w: parameter('power_w', 'P', 'power', 'signal', 0, 50_000),
    voltage_v: parameter('voltage_v', 'V', 'voltage', 'signal', 0, 1000),
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
    'vd_m3',
];

export function withinRange(key: ParameterKey, si: number): boolean {
    const { min, max } = PARAMETERS[key];

    return Number.isFinite(si) && si >= min && si <= max;
}
