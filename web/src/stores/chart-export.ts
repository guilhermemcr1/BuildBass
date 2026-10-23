import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LEGEND_GROUPS } from '@/lib/chart-export/types';
import type {
    ExportFormat,
    LegendGroup,
    LegendGroups,
} from '@/lib/chart-export/types';
import { createSafeStorage } from './preferences';

export const CHART_EXPORT_KEY = 'buildbass.chart-export';

const DEFAULT_GROUPS: LegendGroups = {
    peak: true,
    cutoffs: true,
    box: true,
    limits: true,
};

export function validFormat(value: unknown): value is ExportFormat {
    return value === 'png' || value === 'pdf';
}

type ChartExportState = {
    format: ExportFormat;
    groups: LegendGroups;
    setFormat: (format: ExportFormat) => void;
    setGroup: (group: LegendGroup, enabled: boolean) => void;
};

// Escolhas do diálogo de exportação do gráfico (specs/011): ficam no navegador, como as demais
// preferências da bancada, e nunca entram no arquivo de projeto.
export const useChartExport = create<ChartExportState>()(
    persist(
        (set) => ({
            format: 'png',
            groups: DEFAULT_GROUPS,
            setFormat: (format) => set({ format }),
            setGroup: (group, enabled) =>
                set((state) => ({
                    groups: { ...state.groups, [group]: enabled },
                })),
        }),
        {
            name: CHART_EXPORT_KEY,
            version: 1,
            storage: createJSONStorage(() => createSafeStorage()),
            partialize: ({ format, groups }) => ({ format, groups }),
            // Valor inválido (arquivo adulterado) volta ao padrão, campo a campo.
            merge: (persisted, current) => {
                const saved = (persisted ?? {}) as {
                    format?: unknown;
                    groups?: Partial<Record<LegendGroup, unknown>>;
                };
                const groups = { ...DEFAULT_GROUPS };

                LEGEND_GROUPS.forEach((group) => {
                    const value = saved.groups?.[group];

                    if (typeof value === 'boolean') {
                        groups[group] = value;
                    }
                });

                return {
                    ...current,
                    format: validFormat(saved.format)
                        ? saved.format
                        : current.format,
                    groups,
                };
            },
        },
    ),
);
