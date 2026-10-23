import { useState } from 'react';
import { activeProjectStore } from '@/hooks/use-active-project';
import { fetchDriver } from '@/lib/catalog/client';
import { toDriverInput } from '@/lib/catalog/to-driver-input';
import type { CatalogError, DriverSummary } from '@/lib/catalog/types';
import { identityOf } from '@/lib/saved-drivers/types';
import { useCatalogGallery } from '@/stores/catalog-gallery';
import { useRecentDrivers } from '@/stores/recent-drivers';

export type CatalogPick = {
    applying: boolean;
    applyError?: CatalogError;
    // Devolve true quando o driver foi copiado para o projeto ativo.
    choose: (summary: DriverSummary) => Promise<boolean>;
    clearError: () => void;
};

// Escolher = buscar o detalhe e só então copiar (FR-009): se algo falhar, o projeto fica como
// estava. Copiar registra o driver nos recentes.
export function useCatalogPick(): CatalogPick {
    const [applying, setApplying] = useState(false);
    const [applyError, setApplyError] = useState<CatalogError>();
    const addRecent = useRecentDrivers((state) => state.add);

    const choose = async (summary: DriverSummary) => {
        if (applying) {
            return false;
        }

        setApplying(true);
        setApplyError(undefined);
        const result = await fetchDriver(summary.id);
        setApplying(false);

        if (!result.ok) {
            setApplyError(result.aborted ? 'network' : result.error);

            return false;
        }

        const { driver, source, dims } = toDriverInput(result.data.data);
        activeProjectStore()
            .getState()
            .applyCatalogDriver(driver, source, dims);
        // As imagens não vão para o projeto nem para os recentes: ficam só na galeria da sessão.
        useCatalogGallery.getState().set(
            identityOf({
                brand: result.data.data.brand,
                model: result.data.data.model,
                variant: result.data.data.variant ?? undefined,
            }),
            result.data.data.images,
        );
        addRecent({
            id: summary.id,
            brand: summary.brand,
            model: summary.model,
            ...(summary.variant === null ? {} : { variant: summary.variant }),
            ...(summary.type === undefined ? {} : { type: summary.type }),
            ...(summary.nominal_diameter_m === undefined
                ? {}
                : { nominal_diameter_m: summary.nominal_diameter_m }),
            ...(summary.cover_thumb_url === undefined
                ? {}
                : { cover_thumb_url: summary.cover_thumb_url }),
            fs_hz: summary.fs_hz,
            qts: summary.qts,
            vas_m3: summary.vas_m3,
        });

        return true;
    };

    return {
        applying,
        applyError,
        choose,
        clearError: () => setApplyError(undefined),
    };
}
