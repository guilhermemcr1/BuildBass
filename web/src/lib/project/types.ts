import type { CutPlanConfig } from '@/cutplan';
import type { ProjectInput } from '@/engine';
import type { ParameterKey } from '@/lib/parameters';
import type { UnitId } from '@/lib/units/quantities';

export type {
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

// De onde veio o driver copiado do catálogo. Só informação: não aponta de volta ao catálogo
// (specs/003, FR-008).
export type DriverSource = {
    brand: string;
    model: string;
    variant?: string;
};

// O projeto completo (data-model.md): a entrada do motor mais a unidade escolhida em cada campo.
export type ProjectData = ProjectInput & {
    driverSource?: DriverSource;
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
