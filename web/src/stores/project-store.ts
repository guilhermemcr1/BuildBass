import { temporal } from 'zundo';
import { createStore } from 'zustand/vanilla';
import { twoChambers } from '@/engine';
import type { CatalogDims } from '@/lib/catalog/to-driver-input';
import type { ParameterKey } from '@/lib/parameters';
import {
    applyCatalogDims,
    withDriver,
    withIdentity,
    writeField,
} from '@/lib/project/fields';
import type {
    BoxFill,
    BoxType,
    DriverInput,
    DriverKey,
    DriversInput,
    DriverSource,
    PortInput,
    ProjectData,
    SignalInput,
} from '@/lib/project/types';
import type { SavedDriverDraft } from '@/lib/saved-drivers/types';
import type { UnitId } from '@/lib/units/quantities';

type BoxValueKey = 'vb_m3' | 'vr_m3' | 'vf_m3' | 'fb_hz' | 'fb_rear_hz' | 'ql';

export type ProjectState = {
    data: ProjectData;
    setName: (name: string) => void;
    setDriverValue: (key: DriverKey, si: number | undefined) => void;
    setBoxValue: (key: BoxValueKey, si: number | undefined) => void;
    setBoxType: (type: BoxType) => void;
    setBoxFill: (fill: BoxFill) => void;
    setPort: (port: PortInput) => void;
    setPortRear: (port: PortInput) => void;
    setDrivers: (drivers: Partial<DriversInput>) => void;
    setSignal: (signal: Partial<SignalInput>) => void;
    setFieldUnit: (key: ParameterKey, unit: UnitId) => void;
    clearFieldUnits: () => void;
    // Copia um driver do catálogo: substitui o driver por inteiro e registra a origem, numa etapa
    // só de desfazer.
    // Quando o cadastro traz medidas físicas, elas substituem as do projeto (formato, pistão e
    // cotas A–G, com o recorte no plano de corte); sem medidas, as do projeto ficam como estão.
    applyCatalogDriver: (
        driver: DriverInput,
        source: DriverSource,
        dims?: CatalogDims,
    ) => void;
    // Edita a identificação do driver (marca, modelo, variação, tipo); parte vazia é apagada.
    setDriverIdentity: (patch: Partial<DriverSource>) => void;
    // Aplica um alto-falante salvo pelo usuário: driver, origem e, quando o salvo traz, o recorte
    // do plano de corte, numa etapa só de desfazer.
    applySavedDriver: (saved: SavedDriverDraft) => void;
    // Várias mudanças numa única etapa de desfazer (ex.: sugestão de caixa).
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
                        update((data) =>
                            withDriver(data, withValue(data.driver, key, si)),
                        ),
                    setBoxValue: (key, si) =>
                        update((data) => ({
                            ...data,
                            box:
                                key === 'ql'
                                    ? { ...data.box, ql: si ?? 7 }
                                    : withValue(data.box, key, si),
                        })),
                    // Ao escolher bandpass, as câmaras vazias partem do Vb já digitado (uma etapa só
                    // de desfazer); cada tipo guarda os próprios campos. Na de
                    // 6ª ordem o duto traseiro parte de uma cópia do frontal; Fbr não é semeada.
                    setBoxType: (type) =>
                        update((data) => {
                            const { vb_m3 } = data.box;
                            const chambers =
                                twoChambers(type) && vb_m3 !== undefined
                                    ? {
                                          vr_m3: data.box.vr_m3 ?? vb_m3,
                                          vf_m3: data.box.vf_m3 ?? vb_m3,
                                      }
                                    : {};
                            const rearPort =
                                type === 'bandpass6' &&
                                data.box.port_rear === undefined
                                    ? { port_rear: data.box.port }
                                    : {};

                            return {
                                ...data,
                                box: {
                                    ...data.box,
                                    ...chambers,
                                    ...rearPort,
                                    type,
                                },
                            };
                        }),
                    // Sem material não fica gravado, para o arquivo não subir de versão à toa.
                    setBoxFill: (fill) =>
                        update((data) => {
                            const { fill: _old, ...box } = data.box;

                            return {
                                ...data,
                                box: fill === 'none' ? box : { ...box, fill },
                            };
                        }),
                    setPort: (port) =>
                        update((data) => ({
                            ...data,
                            box: { ...data.box, port },
                        })),
                    setPortRear: (port) =>
                        update((data) => ({
                            ...data,
                            box: { ...data.box, port_rear: port },
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
                    setDriverIdentity: (patch) =>
                        update((data) => withIdentity(data, patch)),
                    applyCatalogDriver: (driver, source, dims) =>
                        update((data) => {
                            const applied = {
                                ...data,
                                driver,
                                driverSource: source,
                            };

                            return dims === undefined
                                ? applied
                                : applyCatalogDims(applied, dims);
                        }),
                    applySavedDriver: (saved) =>
                        update((data) => {
                            const applied = {
                                ...data,
                                driver: saved.driver,
                                driverSource: {
                                    brand: saved.brand,
                                    model: saved.model,
                                    ...(saved.variant === undefined
                                        ? {}
                                        : { variant: saved.variant }),
                                    ...(saved.type === undefined
                                        ? {}
                                        : { type: saved.type }),
                                },
                            };

                            // Diâmetro e profundidade salvos são o A e o G das dimensões.
                            const measures: [
                                ParameterKey,
                                number | undefined,
                            ][] = [
                                ['cutout_m', saved.cutout_m],
                                ['drv_a_m', saved.nominal_diameter_m],
                                ['drv_g_m', saved.depth_m],
                            ];

                            return measures.reduce<ProjectData>(
                                (next, [key, si]) =>
                                    si === undefined
                                        ? next
                                        : writeField(next, key, si),
                                applied,
                            );
                        }),
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
