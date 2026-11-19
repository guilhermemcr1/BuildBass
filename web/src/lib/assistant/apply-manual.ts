import type { DriverKey } from '@/engine';
import type { ManualSuggestion } from '@/lib/submission/manual-schema';
import type { NumericKey } from '@/lib/submission/schema';
import type { ProjectData } from '@/lib/project/types';
import { withDriverDims, withIdentity } from '@/lib/project/fields';

// Aplica a leitura por IA (manual ou texto) ao projeto: só campos vazios recebem valor, como no
// formulário de envio. O diâmetro nominal vira a cota A das dimensões, quando ela está vazia.
// Devolve os campos preenchidos (chaves da sugestão), para o aviso e o destaque.
export function applyManualToProject(
    data: ProjectData,
    suggestion: ManualSuggestion,
): { data: ProjectData; filled: NumericKey[] } {
    const filled: NumericKey[] = [];
    const driver = { ...data.driver };

    for (const [key, value] of Object.entries(suggestion.numbers) as [
        NumericKey,
        number,
    ][]) {
        if (key === 'nominal_diameter_m') {
            continue;
        }

        if (driver[key as DriverKey] === undefined) {
            driver[key as DriverKey] = value;
            filled.push(key);
        }
    }

    let next: ProjectData = { ...data, driver };
    const source = data.driverSource ?? {};
    const identity = {
        ...(source.brand === undefined && suggestion.brand !== undefined
            ? { brand: suggestion.brand }
            : {}),
        ...(source.model === undefined && suggestion.model !== undefined
            ? { model: suggestion.model }
            : {}),
        ...(source.variant === undefined && suggestion.variant !== undefined
            ? { variant: suggestion.variant }
            : {}),
        ...(source.type === undefined && suggestion.type !== undefined
            ? { type: suggestion.type }
            : {}),
    };

    if (Object.keys(identity).length > 0) {
        next = withIdentity(next, identity);
    }

    const nominal = suggestion.numbers.nominal_diameter_m;

    if (nominal !== undefined && data.driverDims?.a_m === undefined) {
        next = withDriverDims(next, { ...data.driverDims, a_m: nominal });
        filled.push('nominal_diameter_m');
    }

    return { data: next, filled };
}
