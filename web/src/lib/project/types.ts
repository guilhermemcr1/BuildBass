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

// O projeto completo (data-model.md): a entrada do motor mais a unidade escolhida em cada campo.
export type ProjectData = ProjectInput & {
    fieldUnits: Partial<Record<ParameterKey, UnitId>>;
};

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
