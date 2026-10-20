import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { defaultUnitFor } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { useDraft } from '@/stores/draft';
import { usePreferences } from '@/stores/preferences';

// Liga um ParameterField ao rascunho: valor SI e unidade exibida (escolha do campo ou padrão do
// sistema de unidades global).
export function useParameterField(key: ParameterKey) {
    const valueSi = useDraft((state) => state.values[key]);
    const fieldUnit = useDraft((state) => state.fieldUnits[key]);
    const setValue = useDraft((state) => state.setValue);
    const setFieldUnit = useDraft((state) => state.setFieldUnit);
    const unitSystem = usePreferences((state) => state.unitSystem);

    const unit: UnitId =
        fieldUnit ?? defaultUnitFor(PARAMETERS[key].quantity, unitSystem);

    return {
        parameter: key,
        valueSi,
        unit,
        onChangeSi: (si: number) => setValue(key, si),
        onUnitChange: (next: UnitId) => setFieldUnit(key, next),
    };
}
