import { useActiveProject } from '@/hooks/use-active-project';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { readField, writeField } from '@/lib/project/fields';
import { requirementOf } from '@/lib/requirements';
import { defaultUnitFor } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// Liga um ParameterField ao projeto ativo: valor SI e unidade exibida (escolha do campo ou padrão
// do sistema de unidades global).
export function useParameterField(key: ParameterKey) {
    const valueSi = useActiveProject((state) => readField(state.data, key));
    const fieldUnit = useActiveProject((state) => state.data.fieldUnits[key]);
    const apply = useActiveProject((state) => state.apply);
    const setFieldUnit = useActiveProject((state) => state.setFieldUnit);
    const unitSystem = usePreferences((state) => state.unitSystem);
    const boxType = useActiveProject((state) => state.data.box.type);
    const signalMode = useActiveProject((state) => state.data.signal.mode);

    const unit: UnitId =
        fieldUnit ?? defaultUnitFor(PARAMETERS[key].quantity, unitSystem);

    return {
        parameter: key,
        // Asterisco: o campo é indispensável para alguma curva do tipo de caixa escolhido.
        requirement: requirementOf(key, boxType, signalMode),
        valueSi,
        unit,
        onChangeSi: (si: number | undefined) =>
            apply((data) => writeField(data, key, si)),
        onUnitChange: (next: UnitId) => setFieldUnit(key, next),
    };
}
