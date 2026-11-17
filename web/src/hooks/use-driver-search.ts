import { useEffect, useState } from 'react';
import { searchDrivers } from '@/lib/catalog/client';
import type {
    CatalogError,
    DriverFilters,
    DriverSummary,
} from '@/lib/catalog/types';

export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MAX_LENGTH = 60;

export type DriverSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export type DriverSearch = {
    status: DriverSearchStatus;
    items: DriverSummary[];
    hasMore: boolean;
    // Buscando a próxima página: os itens já mostrados continuam na lista.
    loadingMore: boolean;
    error?: CatalogError;
    retry: () => void;
    loadMore: () => void;
};

type State = Omit<DriverSearch, 'retry' | 'loadMore'>;

const IDLE: State = {
    status: 'idle',
    items: [],
    hasMore: false,
    loadingMore: false,
};

type Options = {
    offline?: boolean;
    filters?: DriverFilters;
    // Desligado (ex.: seletor fechado), não consulta nada.
    enabled?: boolean;
};

const NO_FILTERS: DriverFilters = {};

// Busca livre no catálogo: sem texto lista o catálogo (para navegar), e cada letra digitada
// refina. Espera a digitação parar e cada busca nova aborta a anterior, então um resultado
// atrasado nunca sobrepõe um mais novo. Os filtros (tipo, diâmetro) somam-se ao texto, e
// `loadMore` acrescenta a próxima página. Os mesmos limites valem no servidor
// (SearchDriversRequest).
export function useDriverSearch(
    term: string,
    { offline = false, filters = NO_FILTERS, enabled = true }: Options = {},
): DriverSearch {
    const [state, setState] = useState<State>(IDLE);
    const [attempt, setAttempt] = useState(0);
    const query = term.trim().slice(0, SEARCH_MAX_LENGTH);
    // Chave estável: o objeto de filtros muda de identidade a cada render do chamador.
    const filterKey = JSON.stringify(filters);
    const active = enabled && !offline;
    // Página pedida por "Mostrar mais", presa à busca que a pediu: busca nova (texto, filtro ou
    // religar) recomeça da primeira página sem render intermediário.
    const searchKey = `${String(active)}|${query}|${filterKey}`;
    const [page, setPage] = useState({ key: '', offset: 0 });
    const offset = page.key === searchKey ? page.offset : 0;

    useEffect(() => {
        if (!active) {
            setState(IDLE);

            return;
        }

        const more = offset > 0;

        // Os itens anteriores ficam na tela enquanto a nova busca espera e roda.
        setState((current) => ({
            ...current,
            status: more ? current.status : 'loading',
            loadingMore: more,
            error: undefined,
        }));

        const controller = new AbortController();
        const timer = setTimeout(
            () => {
                void searchDrivers(
                    query,
                    JSON.parse(filterKey) as DriverFilters,
                    controller.signal,
                    offset,
                ).then((result) => {
                    if (controller.signal.aborted) {
                        return;
                    }

                    if (result.ok) {
                        setState((current) => ({
                            status: 'ready',
                            items: more
                                ? [...current.items, ...result.data.data]
                                : result.data.data,
                            hasMore: result.data.meta.has_more,
                            loadingMore: false,
                        }));

                        return;
                    }

                    if (result.aborted) {
                        return;
                    }

                    setState((current) => ({
                        ...current,
                        status: 'error',
                        loadingMore: false,
                        error: result.error,
                    }));
                });
            },
            more ? 0 : SEARCH_DEBOUNCE_MS,
        );

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [active, query, filterKey, attempt, offset]);

    return {
        ...state,
        retry: () => setAttempt((current) => current + 1),
        loadMore: () => {
            if (
                state.status === 'ready' &&
                state.hasMore &&
                !state.loadingMore
            ) {
                setPage({ key: searchKey, offset: state.items.length });
            }
        },
    };
}
