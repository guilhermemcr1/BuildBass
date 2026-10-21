import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { FieldStatus } from '@/components/ui/status-indicator';
import { ValueTile } from '@/components/ui/value-tile';
import { PORT_VELOCITY_ERROR_MS, PORT_VELOCITY_WARN_MS } from '@/engine';
import type { SimulationResults, WarningId } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useActiveSimulation, useSimulations } from '@/hooks/use-simulation';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { EngineWarnings } from './engine-warnings';
import { Panel } from './panel';
import { ResultsTable } from './results-table';

type Status = { status: FieldStatus; statusLabel?: string };

function lengthStatus(
    warnings: WarningId[],
    t: (key: string) => string,
): Status {
    if (warnings.includes('portTooShort')) {
        return {
            status: 'error',
            statusLabel: t('engine:status.portTooShort'),
        };
    }

    if (warnings.includes('portTooLong')) {
        return { status: 'warn', statusLabel: t('engine:status.portTooLong') };
    }

    return { status: 'none' };
}

// Velocidade máxima no duto contra os limites de 17 e 25 m/s (FR-011).
function velocityStatus(
    results: SimulationResults,
    format: (si: number) => string,
    t: (key: string, options?: Record<string, string>) => string,
): Status {
    const velocity = results.port_velocity_max_ms;

    if (velocity === undefined) {
        return { status: 'none' };
    }

    if (velocity >= PORT_VELOCITY_ERROR_MS) {
        return {
            status: 'error',
            statusLabel: t('engine:status.velocityError', {
                value: format(PORT_VELOCITY_ERROR_MS),
            }),
        };
    }

    if (velocity >= PORT_VELOCITY_WARN_MS) {
        return {
            status: 'warn',
            statusLabel: t('engine:status.velocityWarn'),
        };
    }

    return {
        status: 'ok',
        statusLabel: t('engine:status.velocityOk', {
            value: format(PORT_VELOCITY_WARN_MS),
        }),
    };
}

// Resultados do projeto ativo, calculados pelo motor (FR-004).
export function ResultsPanel() {
    const { t } = useTranslation(['workbench', 'engine']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const boxType = useActiveProject((state) => state.data.box.type);
    const { results, warnings } = useActiveSimulation();
    const velocityUnit: UnitId = defaultUnitFor('velocity', unitSystem);
    const warningIds = warnings.map(({ id }) => id);
    const plotted = useSimulations();

    return (
        <Panel region="results" title={t('regions.results')}>
            {plotted.length > 1 ? (
                <ResultsTable items={plotted} />
            ) : (
                <div className="grid grid-cols-2 gap-2">
                    {boxType === 'bandpass' ? (
                        <>
                            <ValueTile
                                label={t('results.fLow')}
                                valueSi={results.f_low_hz}
                                unit="Hz"
                                display={
                                    results.f_low_below_range
                                        ? t('results.belowRange')
                                        : undefined
                                }
                            />
                            <ValueTile
                                label={t('results.fHigh')}
                                valueSi={results.f_high_hz}
                                unit="Hz"
                                display={
                                    results.f_high_above_range
                                        ? t('results.aboveRange')
                                        : undefined
                                }
                            />
                            <ValueTile
                                label={t('results.fCenter')}
                                valueSi={results.f_center_hz}
                                unit="Hz"
                            />
                            <ValueTile
                                label={t('results.bandwidth')}
                                valueSi={results.bandwidth_oct}
                                unit="oct"
                            />
                            <ValueTile
                                label={t('results.peak')}
                                valueSi={results.peak_db}
                                unit="dB"
                            />
                        </>
                    ) : (
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
                    )}
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
                                {...lengthStatus(warningIds, t)}
                            />
                            <ValueTile
                                label={t('results.portVelocity')}
                                valueSi={results.port_velocity_max_ms}
                                unit={velocityUnit}
                                {...velocityStatus(
                                    results,
                                    (si) =>
                                        formatWithUnit(
                                            si,
                                            velocityUnit,
                                            locale,
                                        ),
                                    t,
                                )}
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
            )}
            <EngineWarnings />
        </Panel>
    );
}
