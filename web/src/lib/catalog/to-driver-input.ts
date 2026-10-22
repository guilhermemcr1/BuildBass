import { DRIVER_KEYS } from '@/engine';
import type { DriverInput } from '@/engine';
import type { DriverSource } from '@/lib/project/types';
import type { CatalogDriver } from './types';

// Cópia do cadastro para o projeto (FR-006, FR-008): só entram os parâmetros do driver, com o
// valor exato; id e fonte ficam de fora, e a identificação (com o tipo) não aponta de volta ao
// catálogo.
export function toDriverInput(catalog: CatalogDriver): {
    driver: DriverInput;
    source: DriverSource;
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

    return { driver, source };
}
