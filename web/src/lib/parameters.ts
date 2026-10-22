import { CUT_PLAN_LIMITS } from '@/cutplan/config';
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
    | 'vr_m3'
    | 'vf_m3'
    | 'fb_hz'
    | 'fb_rear_hz'
    | 'ql'
    | 'diameter_m'
    | 'width_m'
    | 'height_m'
    | 'base_m'
    | 'rear_diameter_m'
    | 'rear_width_m'
    | 'rear_height_m'
    | 'rear_base_m'
    | 'port_count'
    | 'rear_port_count'
    | 'driver_count'
    | 'power_w'
    | 'voltage_v'
    | 'thickness_m'
    | 'braces_m3'
    | 'cutout_m'
    | 'ratio_h'
    | 'ratio_w'
    | 'ratio_d'
    | 'drv_a_m'
    | 'drv_b_m'
    | 'drv_d_m'
    | 'drv_e_m'
    | 'drv_f_m'
    | 'drv_g_m'
    | 'dim_h_m'
    | 'dim_w_m'
    | 'dim_d_m'
    | 'sheet_w_m'
    | 'sheet_h_m'
    | 'kerf_m';

export type ParameterGroup =
    | 'driver'
    | 'dims'
    | 'box'
    | 'port'
    | 'signal'
    | 'plan';

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
    vr_m3: parameter('vr_m3', 'Vr', 'volume', 'box', 1e-4, 20),
    vf_m3: parameter('vf_m3', 'Vf', 'volume', 'box', 1e-4, 20),
    vd_m3: parameter('vd_m3', 'Vd', 'volume', 'driver', 0, 0.1),
    fb_hz: parameter('fb_hz', 'Fb', 'frequency', 'box', 5, 500),
    // Bandpass de 6ª ordem: sintonia da câmara traseira, na faixa de `fb_hz`.
    fb_rear_hz: parameter('fb_rear_hz', 'Fbr', 'frequency', 'box', 5, 500),
    ql: parameter('ql', 'Ql', 'ratio', 'box', 1, 100),
    diameter_m: parameter('diameter_m', 'Ø', 'length', 'port', 0.005, 1),
    width_m: parameter('width_m', 'W', 'length', 'port', 0.005, 2),
    height_m: parameter('height_m', 'H', 'length', 'port', 0.005, 2),
    base_m: parameter('base_m', 'B', 'length', 'port', 0.005, 2),
    // Duto da câmara traseira da bandpass de 6ª ordem: mesmas grandezas e faixas do frontal.
    rear_diameter_m: parameter(
        'rear_diameter_m',
        'Ø',
        'length',
        'port',
        0.005,
        1,
    ),
    rear_width_m: parameter('rear_width_m', 'W', 'length', 'port', 0.005, 2),
    rear_height_m: parameter('rear_height_m', 'H', 'length', 'port', 0.005, 2),
    rear_base_m: parameter('rear_base_m', 'B', 'length', 'port', 0.005, 2),
    port_count: parameter('port_count', 'n', 'count', 'port', 1, 8),
    rear_port_count: parameter('rear_port_count', 'n', 'count', 'port', 1, 8),
    driver_count: parameter('driver_count', 'N', 'count', 'driver', 1, 8),
    power_w: parameter('power_w', 'P', 'power', 'signal', 0, 50_000),
    voltage_v: parameter('voltage_v', 'V', 'voltage', 'signal', 0, 1000),
    // Plano de corte (specs/005): faixas em CUT_PLAN_LIMITS.
    thickness_m: parameter(
        'thickness_m',
        't',
        'length',
        'plan',
        CUT_PLAN_LIMITS.thickness_m.min,
        CUT_PLAN_LIMITS.thickness_m.max,
    ),
    braces_m3: parameter(
        'braces_m3',
        'Vrf',
        'volume',
        'plan',
        CUT_PLAN_LIMITS.braces_m3.min,
        CUT_PLAN_LIMITS.braces_m3.max,
    ),
    cutout_m: parameter(
        'cutout_m',
        'Ød',
        'length',
        'plan',
        CUT_PLAN_LIMITS.cutout_m.min,
        CUT_PLAN_LIMITS.cutout_m.max,
    ),
    ratio_h: parameter(
        'ratio_h',
        'Rh',
        'ratio',
        'plan',
        CUT_PLAN_LIMITS.ratio.min,
        CUT_PLAN_LIMITS.ratio.max,
    ),
    ratio_w: parameter(
        'ratio_w',
        'Rw',
        'ratio',
        'plan',
        CUT_PLAN_LIMITS.ratio.min,
        CUT_PLAN_LIMITS.ratio.max,
    ),
    ratio_d: parameter(
        'ratio_d',
        'Rd',
        'ratio',
        'plan',
        CUT_PLAN_LIMITS.ratio.min,
        CUT_PLAN_LIMITS.ratio.max,
    ),
    // Medidas físicas do alto-falante (aba Dimensions do BassBox); A–G seguem o desenho dela.
    drv_a_m: parameter('drv_a_m', 'A', 'length', 'dims', 0.03, 1.5),
    drv_b_m: parameter('drv_b_m', 'B', 'length', 'dims', 0.02, 1.5),
    drv_d_m: parameter('drv_d_m', 'D', 'length', 'dims', 0.03, 1.5),
    drv_e_m: parameter('drv_e_m', 'E', 'length', 'dims', 0.005, 1),
    drv_f_m: parameter('drv_f_m', 'F', 'length', 'dims', 0.001, 0.2),
    drv_g_m: parameter('drv_g_m', 'G', 'length', 'dims', 0.01, 1),
    // Medidas internas da caixa (editáveis na Caixa): editar uma ajusta as outras duas e mantém o
    // volume. Não ficam no projeto: derivam da proporção (`writeDimension`).
    dim_h_m: parameter('dim_h_m', 'Hi', 'length', 'plan', 0.02, 3),
    dim_w_m: parameter('dim_w_m', 'Wi', 'length', 'plan', 0.02, 3),
    dim_d_m: parameter('dim_d_m', 'Di', 'length', 'plan', 0.02, 3),
    // Chapa que o usuário tem e perda de serra (specs/008).
    sheet_w_m: parameter(
        'sheet_w_m',
        'Wc',
        'length',
        'plan',
        CUT_PLAN_LIMITS.sheet_w_m.min,
        CUT_PLAN_LIMITS.sheet_w_m.max,
    ),
    sheet_h_m: parameter(
        'sheet_h_m',
        'Hc',
        'length',
        'plan',
        CUT_PLAN_LIMITS.sheet_h_m.min,
        CUT_PLAN_LIMITS.sheet_h_m.max,
    ),
    kerf_m: parameter(
        'kerf_m',
        'Ps',
        'length',
        'plan',
        CUT_PLAN_LIMITS.kerf_m.min,
        CUT_PLAN_LIMITS.kerf_m.max,
    ),
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

// Campos do driver sempre à vista no modo Normal (specs/008, R13); os demais ficam atrás de
// "Mostrar mais". Fonte única: mudar a lista é editar esta constante.
export const ESSENTIAL_DRIVER_PARAMETERS: ParameterKey[] =
    DRIVER_PARAMETERS.filter((key) =>
        ['fs_hz', 'qts', 'vas_m3', 'sd_m2', 'xmax_m', 'pe_w'].includes(key),
    );

// Seções recolhíveis da bancada ("Mostrar mais").
export type SectionId = 'driverAdvanced' | 'driverDims' | 'planAdvanced';

export const SECTION_IDS: SectionId[] = [
    'driverAdvanced',
    'driverDims',
    'planAdvanced',
];

// Medidas físicas do alto-falante, na seção "Dimensões" do Driver: A, B, D, E, F, G e o volume do
// motor (M-Vd, `vd_m3`); o recorte C é `cutout_m`.
export const DRIVER_DIMENSION_PARAMETERS: ParameterKey[] = [
    'drv_a_m',
    'drv_b_m',
    'cutout_m',
    'drv_d_m',
    'drv_e_m',
    'drv_f_m',
    'drv_g_m',
    'vd_m3',
];

const PLAN_ADVANCED_PARAMETERS: ParameterKey[] = ['braces_m3', 'kerf_m'];

// Em que seção recolhível o campo mora; `undefined` = sempre à vista.
export function sectionOf(parameter: ParameterKey): SectionId | undefined {
    if (parameter === 'vd_m3' || PARAMETERS[parameter].group === 'dims') {
        return 'driverDims';
    }

    if (
        DRIVER_PARAMETERS.includes(parameter) &&
        !ESSENTIAL_DRIVER_PARAMETERS.includes(parameter)
    ) {
        return 'driverAdvanced';
    }

    return PLAN_ADVANCED_PARAMETERS.includes(parameter)
        ? 'planAdvanced'
        : undefined;
}

export function withinRange(key: ParameterKey, si: number): boolean {
    const { min, max } = PARAMETERS[key];

    return Number.isFinite(si) && si >= min && si <= max;
}
