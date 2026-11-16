import type { CutPlanConfig } from '@/cutplan';
import type { ProjectInput } from '@/engine';
import type { ParameterKey } from '@/lib/parameters';
import type { UnitId } from '@/lib/units/quantities';

export type {
    BoxFill,
    BoxInput,
    BoxType,
    DriverInput,
    DriverKey,
    DriversInput,
    PortInput,
    PortShape,
    Radiation,
    SignalInput,
    Wiring,
} from '@/engine';

// Tipos de alto-falante (opcional); os mesmos de App\Models\Driver::TYPES na API.
export const DRIVER_TYPES = [
    'subwoofer',
    'woofer',
    'midbass',
    'midrange',
    'fullrange',
] as const;

export type DriverType = (typeof DRIVER_TYPES)[number];

export function isDriverType(value: unknown): value is DriverType {
    return DRIVER_TYPES.some((type) => type === value);
}

// Identificação do driver do projeto: preenchida ao copiar do catálogo ou de "Meus alto-falantes"
// e editável à mão. Só informação: não aponta de volta ao catálogo (specs/003, FR-008), e cada
// parte pode faltar.
export type DriverSource = {
    brand?: string;
    model?: string;
    variant?: string;
    type?: DriverType;
};

// Medidas físicas do alto-falante, como a aba "Dimensions" do BassBox. O recorte (C) mora em
// `cutPlan.cutout_m` e o volume do motor (M-Vd) em `driver.vd_m3`: um valor só, dois lugares de edição.
export type DriverShape = 'round' | 'square' | 'rect';
export type DriverPiston = 'cone' | 'dome' | 'flat';

export type DriverDims = {
    shape?: DriverShape;
    piston?: DriverPiston;
    // A: aro externo. B: diâmetro do cone. D: segundo lado (quadrado e retangular).
    a_m?: number;
    b_m?: number;
    d_m?: number;
    // E: profundidade do ímã. F: espessura do aro. G: profundidade total.
    e_m?: number;
    f_m?: number;
    g_m?: number;
};

export const DRIVER_SHAPES: DriverShape[] = ['round', 'square', 'rect'];
export const DRIVER_PISTONS: DriverPiston[] = ['cone', 'dome', 'flat'];

// O projeto completo (data-model.md): a entrada do motor mais a unidade escolhida em cada campo.
export type ProjectData = ProjectInput & {
    driverSource?: DriverSource;
    // Medidas físicas do alto-falante (versão 6 do arquivo).
    driverDims?: DriverDims;
    // Configuração do plano de corte (specs/005): só o que o usuário alterou.
    cutPlan?: CutPlanConfig;
    fieldUnits: Partial<Record<ParameterKey, UnitId>>;
};

// Cor do projeto (tokens --series-N), escolhida pelo usuário na aba (specs/008, FR-006). Vive no
// projeto aberto e no arquivo, não no `ProjectData`.
export type SeriesColor = 1 | 2 | 3 | 4 | 5 | 6;

export const SERIES_COLORS: SeriesColor[] = [1, 2, 3, 4, 5, 6];

export function validColor(value: unknown): value is SeriesColor {
    return SERIES_COLORS.some((color) => color === value);
}

export const PROJECT_NAME_MAX = 80;

export function createProjectData(name: string): ProjectData {
    return {
        name,
        driver: {},
        drivers: { count: 1, wiring: 'parallel' },
        box: {
            type: 'vented',
            ql: 7,
            port: { shape: 'round', diameter_m: 0.1, count: 1 },
        },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
        fieldUnits: {},
    };
}
