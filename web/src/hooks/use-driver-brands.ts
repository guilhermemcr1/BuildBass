import { useEffect, useState } from 'react';
import { fetchBrands } from '@/lib/catalog/client';

// A lista de marcas muda raramente: uma consulta por sessão basta, guardada fora do componente
// para o seletor reabrir sem esperar.
let cached: string[] | undefined;

export function resetBrandsCache() {
    cached = undefined;
}

// Marcas do catálogo para o filtro. Só consulta quando `enabled` (seletor aberto e online); falha
// de rede deixa a lista vazia, e o filtro some em vez de mostrar erro.
export function useDriverBrands(enabled: boolean): string[] {
    const [brands, setBrands] = useState<string[]>(cached ?? []);

    useEffect(() => {
        if (!enabled || cached !== undefined) {
            return;
        }

        const controller = new AbortController();

        void fetchBrands(controller.signal).then((result) => {
            if (result.ok) {
                cached = result.data.data;
                setBrands(cached);
            }
        });

        return () => controller.abort();
    }, [enabled]);

    return brands;
}
