import { useTranslation } from 'react-i18next';
import { ValueTile } from '@/components/ui/value-tile';
import { useActiveProject } from '@/hooks/use-active-project';
import { useActiveSimulation } from '@/hooks/use-simulation';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { Panel } from './panel';

// Resultados do projeto ativo, calculados pelo motor (FR-004).
export function ResultsPanel() {
    const { t } = useTranslation('workbench');
    const unitSystem = usePreferences((state) => state.unitSystem);
    const boxType = useActiveProject((state) => state.data.box.type);
    const { results } = useActiveSimulation();

    return (
        <Panel region="results" title={t('regions.results')}>
            <div className="grid grid-cols-2 gap-2">
                <ValueTile
                    label={t('results.f3')}
                    valueSi={results.f3_hz}
                    unit="Hz"
                    display={
                        results.f3_below_range
                            ? t('results.belowRange')
                            : undefined
                    }
                />
                {boxType === 'closed' ? (
                    <>
                        <ValueTile
                            label={t('results.qtc')}
                            valueSi={results.qtc}
                            unit="none"
                        />
                        <ValueTile
                            label={t('results.fc')}
                            valueSi={results.fc_hz}
                            unit="Hz"
                        />
                    </>
                ) : (
                    <>
                        <ValueTile
                            label={t('results.fb')}
                            valueSi={results.fb_hz}
                            unit="Hz"
                        />
                        <ValueTile
                            label={t('results.portLength')}
                            valueSi={results.port_length_m}
                            unit={defaultUnitFor('length', unitSystem)}
                        />
                    </>
                )}
                <ValueTile
                    label={t('results.xmaxPower')}
                    valueSi={results.xmax_power_w}
                    unit="W"
                />
                <ValueTile
                    label={t('results.spl0')}
                    valueSi={results.spl0_db}
                    unit="dB"
                />
                <ValueTile
                    label={t('results.efficiency')}
                    valueSi={results.efficiency}
                    unit="percent"
                />
            </div>
        </Panel>
    );
}
