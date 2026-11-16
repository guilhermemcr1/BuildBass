import { DRIVER_KEYS } from '@/engine';
import type { DriverInput } from '@/engine';
import type {
    DriverPiston,
    DriverShape,
    DriverSource,
} from '@/lib/project/types';
import { CATALOG_DIMENSION_KEYS } from './types';
import type { CatalogDriver, CatalogDimensionKey } from './types';

// Medidas físicas do cadastro, prontas para o projeto: formato, pistão e as cotas A–G.
export type CatalogDims = {
    shape?: DriverShape;
    piston?: DriverPiston;
    measures: Partial<Record<CatalogDimensionKey, number>>;
};

// Cópia do cadastro para o projeto: só entram os parâmetros do driver, com o
// valor exato; id e fonte ficam de fora, e a identificação (com o tipo) não aponta de volta ao
// catálogo.
export function toDriverInput(catalog: CatalogDriver): {
    driver: DriverInput;
    source: DriverSource;
    // Só quando o cadastro traz alguma medida física.
    dims?: CatalogDims;
} {
    const driver: DriverInput = {};

    for (const key of DRIVER_KEYS) {
        const value = catalog[key];

        if (value !== undefined) {
            driver[key] = value;
        }
    }

    const source: DriverSource = {
        brand: catalog.brand,
        model: catalog.model,
    };

    if (catalog.variant !== null) {
        source.variant = catalog.variant;
    }

    if (catalog.type !== undefined) {
        source.type = catalog.type;
    }

    const dims: CatalogDims = { measures: {} };

    if (catalog.drv_shape !== undefined) {
        dims.shape = catalog.drv_shape;
    }

    if (catalog.drv_piston !== undefined) {
        dims.piston = catalog.drv_piston;
    }

    for (const key of CATALOG_DIMENSION_KEYS) {
        const value = catalog[key];

        if (value !== undefined) {
            dims.measures[key] = value;
        }
    }

    const hasDims =
        dims.shape !== undefined ||
        dims.piston !== undefined ||
        Object.keys(dims.measures).length > 0;

    return hasDims ? { driver, source, dims } : { driver, source };
}
