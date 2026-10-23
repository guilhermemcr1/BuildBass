import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isDriverType } from '@/lib/project/types';
import type { DriverType } from '@/lib/project/types';
import { createSafeStorage } from './preferences';

export const RECENT_DRIVERS_KEY = 'buildbass.recentDrivers';
export const RECENT_DRIVERS_MAX = 5;

// Só o resumo para listar; o detalhe vem do servidor ao escolher.
export type RecentDriver = {
    id: string;
    brand: string;
    model: string;
    variant?: string;
    type?: DriverType;
    nominal_diameter_m?: number;
    // Miniatura da capa, para a lista de recentes mostrar a foto como o catálogo.
    cover_thumb_url?: string;
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

// Só http(s): o valor vem do navegador, terreno do usuário.
function imageUrl(value: unknown): value is string {
    return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function summary(driver: RecentDriver): RecentDriver {
    const {
        id,
        brand,
        model,
        variant,
        type,
        nominal_diameter_m,
        cover_thumb_url,
        fs_hz,
        qts,
        vas_m3,
    } = driver;

    return {
        id,
        brand,
        model,
        ...(variant === undefined ? {} : { variant }),
        ...(type === undefined ? {} : { type }),
        ...(nominal_diameter_m === undefined ? {} : { nominal_diameter_m }),
        ...(cover_thumb_url === undefined ? {} : { cover_thumb_url }),
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
                    ...(isDriverType(item.type) ? { type: item.type } : {}),
                    ...(finite(item.nominal_diameter_m)
                        ? { nominal_diameter_m: item.nominal_diameter_m }
                        : {}),
                    ...(imageUrl(item.cover_thumb_url)
                        ? { cover_thumb_url: item.cover_thumb_url }
                        : {}),
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
