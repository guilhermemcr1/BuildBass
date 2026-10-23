import type {
    DriverKey,
    DriverPiston,
    DriverShape,
    DriverSource,
    DriverType,
} from '@/lib/project/types';
import type { ParameterKey } from '@/lib/parameters';

export type { DriverSource };

// Formas da API do catálogo (specs/003-catalogo-de-drivers/contracts/catalog-api.md). Tudo em SI,
// com os mesmos nomes de campo do projeto.

// Imagem de um driver (feature 010): WebP ampliado e miniatura, URLs absolutas do servidor.
export type DriverImageRef = {
    url: string;
    thumb_url: string;
};

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
    // Miniatura da capa; a chave não vem no JSON quando o driver não tem imagem.
    cover_thumb_url?: string;
};

// Cotas físicas do alto-falante (A–G, em metros), com as chaves dos parâmetros da bancada.
export const CATALOG_DIMENSION_KEYS = [
    'drv_a_m',
    'drv_b_m',
    'cutout_m',
    'drv_d_m',
    'drv_e_m',
    'drv_f_m',
    'drv_g_m',
] as const satisfies readonly ParameterKey[];

export type CatalogDimensionKey = (typeof CATALOG_DIMENSION_KEYS)[number];

export type CatalogDriver = DriverSummary &
    Partial<Record<DriverKey, number>> &
    Partial<Record<CatalogDimensionKey, number>> & {
        // Formato e pistão; opcionais como as cotas.
        drv_shape?: DriverShape;
        drv_piston?: DriverPiston;
        source: string;
        // Galeria na ordem definida pelo moderador; o primeiro item é a capa.
        images: DriverImageRef[];
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
