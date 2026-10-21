import { useEffect, useState } from 'react';
import { searchDrivers } from '@/lib/catalog/client';
import type { CatalogError, DriverSummary } from '@/lib/catalog/types';

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

type Options = { offline?: boolean };

// Busca no catálogo enquanto o usuário digita (FR-001–003): espera a digitação parar, exige
// 2 caracteres, e cada busca nova aborta a anterior, então um resultado atrasado nunca sobrepõe um
// mais novo. Os mesmos limites do termo valem no servidor (SearchDriversRequest).
export function useDriverSearch(
    term: string,
    { offline = false }: Options = {},
): DriverSearch {
    const [state, setState] = useState<State>(IDLE);
    const [attempt, setAttempt] = useState(0);
    const query = term.trim().slice(0, SEARCH_MAX_LENGTH);
    const active = !offline && query.length >= SEARCH_MIN_LENGTH;

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
            void searchDrivers(query, controller.signal).then((result) => {
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
    }, [active, query, attempt]);

    return {
        ...state,
        retry: () => setAttempt((current) => current + 1),
    };
}
