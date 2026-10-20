import { temporal } from 'zundo';
import { createStore } from 'zustand/vanilla';
import type { ParameterKey } from '@/lib/parameters';
import type {
    BoxType,
    DriverInput,
    DriverKey,
    DriversInput,
    DriverSource,
    PortInput,
    ProjectData,
    SignalInput,
} from '@/lib/project/types';
import type { UnitId } from '@/lib/units/quantities';

type BoxValueKey = 'vb_m3' | 'fb_hz' | 'ql';

export type ProjectState = {
    data: ProjectData;
    setName: (name: string) => void;
    setDriverValue: (key: DriverKey, si: number | undefined) => void;
    setBoxValue: (key: BoxValueKey, si: number | undefined) => void;
    setBoxType: (type: BoxType) => void;
    setPort: (port: PortInput) => void;
    setDrivers: (drivers: Partial<DriversInput>) => void;
    setSignal: (signal: Partial<SignalInput>) => void;
    setFieldUnit: (key: ParameterKey, unit: UnitId) => void;
    clearFieldUnits: () => void;
    // Copia um driver do catálogo: substitui o driver por inteiro e registra a origem, numa etapa
    // só de desfazer (specs/003, FR-006–008).
    applyCatalogDriver: (driver: DriverInput, source: DriverSource) => void;
    // Várias mudanças numa única etapa de desfazer (ex.: sugestão de caixa, FR-020).
    apply: (update: (data: ProjectData) => ProjectData) => void;
};

type Options = {
    // Mudanças a menos de `groupMs` umas das outras (arrastar slider, digitar) viram um passo só.
    groupMs?: number;
};

const HISTORY_LIMIT = 50;

function withValue<T extends object, K extends string>(
    record: T,
    key: K,
    si: number | undefined,
): T {
    const next = { ...record } as Record<string, unknown>;

    if (si === undefined) {
        delete next[key];
    } else {
        next[key] = si;
    }

    return next as T;
}

export function createProjectStore(
    initial: ProjectData,
    { groupMs = 400 }: Options = {},
) {
    return createStore<ProjectState>()(
        temporal(
            (set) => {
                const update = (change: (data: ProjectData) => ProjectData) =>
                    set((state) => ({ data: change(state.data) }));

                return {
                    data: initial,
                    setName: (name) => update((data) => ({ ...data, name })),
                    setDriverValue: (key, si) =>
                        update((data) => ({
                            ...data,
                            driver: withValue(data.driver, key, si),
                        })),
                    setBoxValue: (key, si) =>
                        update((data) => ({
                            ...data,
                            box:
                                key === 'ql'
                                    ? { ...data.box, ql: si ?? 7 }
                                    : withValue(data.box, key, si),
                        })),
                    setBoxType: (type) =>
                        update((data) => ({
                            ...data,
                            box: { ...data.box, type },
                        })),
                    setPort: (port) =>
                        update((data) => ({
                            ...data,
                            box: { ...data.box, port },
                        })),
                    setDrivers: (drivers) =>
                        update((data) => ({
                            ...data,
                            drivers: { ...data.drivers, ...drivers },
                        })),
                    setSignal: (signal) =>
                        update((data) => ({
                            ...data,
                            signal: { ...data.signal, ...signal },
                        })),
                    setFieldUnit: (key, unit) =>
                        update((data) => ({
                            ...data,
                            fieldUnits: { ...data.fieldUnits, [key]: unit },
                        })),
                    clearFieldUnits: () =>
                        update((data) => ({ ...data, fieldUnits: {} })),
                    applyCatalogDriver: (driver, source) =>
                        update((data) => ({
                            ...data,
                            driver,
                            driverSource: source,
                        })),
                    apply: update,
                };
            },
            {
                limit: HISTORY_LIMIT,
                partialize: (state) => ({ data: state.data }),
                equality: (past, current) => past.data === current.data,
                handleSet: (handleSet) => {
                    let last = Number.NEGATIVE_INFINITY;

                    return (pastState, replace) => {
                        const now = Date.now();

                        if (now - last >= groupMs) {
                            handleSet(pastState, replace as false);
                        }

                        last = now;
                    };
                },
            },
        ),
    );
}

export type ProjectStore = ReturnType<typeof createProjectStore>;
