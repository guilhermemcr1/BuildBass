import type { DriverKey, DriverSource } from '@/lib/project/types';

export type { DriverSource };

// Formas da API do catálogo (specs/003-catalogo-de-drivers/contracts/catalog-api.md). Tudo em SI,
// com os mesmos nomes de campo do projeto.

export type DriverSummary = {
    id: number;
    brand: string;
    model: string;
    variant: string | null;
    fs_hz: number;
    qts: number;
    vas_m3: number;
};

export type CatalogDriver = DriverSummary &
    Partial<Record<DriverKey, number>> & {
        nominal_diameter_m?: number;
        source: string;
    };

export type SearchResponse = {
    data: DriverSummary[];
    meta: { limit: number; has_more: boolean };
};

export type DriverResponse = { data: CatalogDriver };

export type CatalogError =
    | 'network'
    | 'server'
    | 'rateLimited'
    | 'invalid'
    | 'notFound';

export type CatalogResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: CatalogError; aborted?: false }
    | { ok: false; aborted: true };
