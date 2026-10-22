import type { DriverKey, DriverSource, DriverType } from '@/lib/project/types';

export type { DriverSource };

// Formas da API do catálogo (specs/003-catalogo-de-drivers/contracts/catalog-api.md). Tudo em SI,
// com os mesmos nomes de campo do projeto.

export type DriverSummary = {
    id: string;
    brand: string;
    model: string;
    variant: string | null;
    // Opcionais: o cadastro pode não ter (a chave não vem no JSON).
    type?: DriverType;
    nominal_diameter_m?: number;
    fs_hz: number;
    qts: number;
    vas_m3: number;
};

export type CatalogDriver = DriverSummary &
    Partial<Record<DriverKey, number>> & {
        source: string;
    };

// Filtros da busca (marca exata, tipo e faixa de diâmetro com o máximo exclusivo, em metros).
export type DriverFilters = {
    brand?: string;
    type?: DriverType;
    diameter_min_m?: number;
    diameter_max_m?: number;
};

export type BrandsResponse = { data: string[] };

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
