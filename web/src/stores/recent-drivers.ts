import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createSafeStorage } from './preferences';

export const RECENT_DRIVERS_KEY = 'buildbass.recentDrivers';
export const RECENT_DRIVERS_MAX = 5;

// Só o resumo para listar; o detalhe vem do servidor ao escolher.
export type RecentDriver = {
    id: string;
    brand: string;
    model: string;
    variant?: string;
    fs_hz: number;
    qts: number;
    vas_m3: number;
};

type RecentDriversState = {
    items: RecentDriver[];
    add: (driver: RecentDriver) => void;
};

function text(value: unknown): value is string {
    return typeof value === 'string' && value !== '';
}

function finite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function summary(driver: RecentDriver): RecentDriver {
    const { id, brand, model, variant, fs_hz, qts, vas_m3 } = driver;

    return {
        id,
        brand,
        model,
        ...(variant === undefined ? {} : { variant }),
        fs_hz,
        qts,
        vas_m3,
    };
}

// O navegador é terreno do usuário: o que não tem a forma esperada é descartado.
function sanitize(raw: unknown): RecentDriver[] {
    if (!Array.isArray(raw)) {
        return [];
    }

    const items: RecentDriver[] = [];

    for (const entry of raw as unknown[]) {
        if (typeof entry !== 'object' || entry === null) {
            continue;
        }

        const item = entry as Record<string, unknown>;

        if (
            text(item.id) &&
            text(item.brand) &&
            text(item.model) &&
            finite(item.fs_hz) &&
            finite(item.qts) &&
            finite(item.vas_m3) &&
            (item.variant === undefined || typeof item.variant === 'string')
        ) {
            items.push(
                summary({
                    id: item.id,
                    brand: item.brand,
                    model: item.model,
                    variant: item.variant,
                    fs_hz: item.fs_hz,
                    qts: item.qts,
                    vas_m3: item.vas_m3,
                }),
            );
        }
    }

    return items.slice(0, RECENT_DRIVERS_MAX);
}

export const useRecentDrivers = create<RecentDriversState>()(
    persist(
        (set) => ({
            items: [],
            add: (driver) =>
                set(({ items }) => ({
                    items: [
                        summary(driver),
                        ...items.filter(({ id }) => id !== driver.id),
                    ].slice(0, RECENT_DRIVERS_MAX),
                })),
        }),
        {
            name: RECENT_DRIVERS_KEY,
            version: 1,
            storage: createJSONStorage(() => createSafeStorage()),
            partialize: ({ items }) => ({ items }),
            merge: (persisted, current) => ({
                ...current,
                items: sanitize(
                    (persisted as { items?: unknown } | null)?.items,
                ),
            }),
        },
    ),
);
