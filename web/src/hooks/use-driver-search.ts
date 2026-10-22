import { useEffect, useState } from 'react';
import { searchDrivers } from '@/lib/catalog/client';
import type {
    CatalogError,
    DriverFilters,
    DriverSummary,
} from '@/lib/catalog/types';

export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 60;

export type DriverSearchStatus = 'idle' | 'loading' | 'ready' | 'error';

export type DriverSearch = {
    status: DriverSearchStatus;
    items: DriverSummary[];
    hasMore: boolean;
    error?: CatalogError;
    retry: () => void;
};

type State = Omit<DriverSearch, 'retry'>;

const IDLE: State = { status: 'idle', items: [], hasMore: false };

type Options = { offline?: boolean; filters?: DriverFilters };

const NO_FILTERS: DriverFilters = {};

// Busca no catálogo enquanto o usuário digita (FR-001–003): espera a digitação parar, exige
// 2 caracteres de texto, e cada busca nova aborta a anterior, então um resultado atrasado nunca
// sobrepõe um mais novo. Com algum filtro (marca, tipo, diâmetro) a busca roda mesmo sem texto, e
// o texto, quando passa de 2 letras, soma-se a eles. Os mesmos limites valem no servidor
// (SearchDriversRequest).
export function useDriverSearch(
    term: string,
    { offline = false, filters = NO_FILTERS }: Options = {},
): DriverSearch {
    const [state, setState] = useState<State>(IDLE);
    const [attempt, setAttempt] = useState(0);
    const trimmed = term.trim().slice(0, SEARCH_MAX_LENGTH);
    const query = trimmed.length >= SEARCH_MIN_LENGTH ? trimmed : '';
    // Chave estável: o objeto de filtros muda de identidade a cada render do chamador.
    const filterKey = JSON.stringify(filters);
    const filtered = Object.values(filters).some(
        (value) => value !== undefined,
    );
    const active = !offline && (query !== '' || filtered);

    useEffect(() => {
        if (!active) {
            setState(IDLE);

            return;
        }

        // Os itens anteriores ficam na tela enquanto a nova busca espera e roda.
        setState((current) => ({
            ...current,
            status: 'loading',
            error: undefined,
        }));

        const controller = new AbortController();
        const timer = setTimeout(() => {
            void searchDrivers(
                query,
                JSON.parse(filterKey) as DriverFilters,
                controller.signal,
            ).then((result) => {
                if (controller.signal.aborted) {
                    return;
                }

                if (result.ok) {
                    setState({
                        status: 'ready',
                        items: result.data.data,
                        hasMore: result.data.meta.has_more,
                    });

                    return;
                }

                if (result.aborted) {
                    return;
                }

                setState((current) => ({
                    ...current,
                    status: 'error',
                    error: result.error,
                }));
            });
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [active, query, filterKey, attempt]);

    return {
        ...state,
        retry: () => setAttempt((current) => current + 1),
    };
}
