import { useTranslation } from 'react-i18next';
import { ValueTile } from '@/components/ui/value-tile';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { Panel } from './panel';

// Os valores chegam com o motor de cálculo (feature 002); por enquanto os blocos ficam vazios.
export function ResultsPanel() {
    const { t } = useTranslation('workbench');
    const unitSystem = usePreferences((state) => state.unitSystem);

    return (
        <Panel region="results" title={t('regions.results')}>
            <div className="grid grid-cols-2 gap-2">
                <ValueTile label={t('results.f3')} unit="Hz" />
                <ValueTile label={t('results.fb')} unit="Hz" />
                <ValueTile
                    label={t('results.portLength')}
                    unit={defaultUnitFor('length', unitSystem)}
                />
                <ValueTile label={t('results.xmaxPower')} unit="W" />
                <ValueTile label={t('results.efficiency')} unit="percent" />
            </div>
        </Panel>
    );
}
