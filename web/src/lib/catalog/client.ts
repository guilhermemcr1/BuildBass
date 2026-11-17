import { apiUrl } from '@/lib/api';
import type {
    BrandsResponse,
    CatalogError,
    CatalogResult,
    DriverFilters,
    DriverResponse,
    SearchResponse,
} from './types';

// Cliente fino da API do catálogo. Nunca lança: devolve o resultado ou
// o motivo da falha, e `aborted` quando a própria interface cancelou o pedido.

type Parse<T> = (body: unknown) => Promise<T | undefined>;

function errorFor(status: number): CatalogError {
    if (status === 404) {
        return 'notFound';
    }

    if (status === 429) {
        return 'rateLimited';
    }

    if (status === 422) {
        return 'invalid';
    }

    return 'server';
}

function aborted(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}

async function request<T>(
    path: string,
    parse: Parse<T>,
    signal: AbortSignal | undefined,
): Promise<CatalogResult<T>> {
    let response: Response;

    try {
        response = await fetch(apiUrl(path), {
            headers: { Accept: 'application/json' },
            signal,
        });
    } catch (error) {
        return aborted(error)
            ? { ok: false, aborted: true }
            : { ok: false, error: 'network' };
    }

    if (!response.ok) {
        return { ok: false, error: errorFor(response.status) };
    }

    let body: unknown;

    try {
        body = await response.json();
    } catch (error) {
        return aborted(error)
            ? { ok: false, aborted: true }
            : { ok: false, error: 'invalid' };
    }

    if (signal?.aborted === true) {
        return { ok: false, aborted: true };
    }

    // A resposta é entrada não confiável: formato e faixas conferidos antes de chegar ao projeto.
    const data = await parse(body);

    return data === undefined
        ? { ok: false, error: 'invalid' }
        : { ok: true, data };
}

// Zod só é carregado na primeira consulta ao catálogo, fora do pacote inicial.
const parseSearch: Parse<SearchResponse> = async (body) => {
    const { searchResponseSchema } = await import('./schema');
    const parsed = searchResponseSchema.safeParse(body);

    return parsed.success ? parsed.data : undefined;
};

const parseDriver: Parse<DriverResponse> = async (body) => {
    const { driverResponseSchema } = await import('./schema');
    const parsed = driverResponseSchema.safeParse(body);

    return parsed.success ? parsed.data : undefined;
};

const parseBrands: Parse<BrandsResponse> = async (body) => {
    const { brandsResponseSchema } = await import('./schema');
    const parsed = brandsResponseSchema.safeParse(body);

    return parsed.success ? parsed.data : undefined;
};

// Texto e filtros viram a query; sem texto a API lista o catálogo. `offset` pede a próxima página.
export function searchDrivers(
    term: string,
    filters: DriverFilters = {},
    signal?: AbortSignal,
    offset = 0,
): Promise<CatalogResult<SearchResponse>> {
    const params: [string, string][] = term === '' ? [] : [['q', term]];

    if (offset > 0) {
        params.push(['offset', String(offset)]);
    }

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) {
            params.push([key, String(value)]);
        }
    }

    const query = params
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');

    return request(`/api/drivers?${query}`, parseSearch, signal);
}

export function fetchBrands(
    signal?: AbortSignal,
): Promise<CatalogResult<BrandsResponse>> {
    return request('/api/driver-brands', parseBrands, signal);
}

export function fetchDriver(
    id: string,
    signal?: AbortSignal,
): Promise<CatalogResult<DriverResponse>> {
    return request(
        `/api/drivers/${encodeURIComponent(id)}`,
        parseDriver,
        signal,
    );
}
