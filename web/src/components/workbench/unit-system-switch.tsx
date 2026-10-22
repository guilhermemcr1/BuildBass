import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { UnitSystem } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

export function UnitSystemSwitch() {
    const { t } = useTranslation('common');
    const unitSystem = usePreferences((state) => state.unitSystem);
    const setUnitSystem = usePreferences((state) => state.setUnitSystem);

    return (
        <SegmentedControl<UnitSystem>
            label={t('units.system')}
            selected={unitSystem}
            onChange={setUnitSystem}
            options={[
                { id: 'metric', label: t('units.metric'), short: 'mm' },
                { id: 'imperial', label: t('units.imperial'), short: 'in' },
            ]}
        />
    );
}
