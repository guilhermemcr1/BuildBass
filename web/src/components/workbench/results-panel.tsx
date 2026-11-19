import { useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { FieldStatus } from '@/components/ui/status-indicator';
import { ValueTile } from '@/components/ui/value-tile';
import {
    PORT_VELOCITY_ERROR_MS,
    PORT_VELOCITY_WARN_MS,
    twoChambers,
} from '@/engine';
import type { EngineWarning } from '@/engine';
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

// Na bandpass de 6ª ordem cada duto responde só aos avisos da sua câmara.
function lengthStatus(
    warnings: EngineWarning[],
    t: (key: string) => string,
    chamber?: 'rear' | 'front',
): Status {
    const has = (id: EngineWarning['id']) =>
        warnings.some(
            (warning) =>
                warning.id === id &&
                (chamber === undefined || warning.chamber === chamber),
        );

    if (has('portTooShort')) {
        return {
            status: 'error',
            statusLabel: t('engine:status.portTooShort'),
        };
    }

    if (has('portTooLong')) {
        return { status: 'warn', statusLabel: t('engine:status.portTooLong') };
    }

    return { status: 'none' };
}

// Velocidade máxima no duto contra os limites de 17 e 25 m/s.
function velocityStatus(
    velocity: number | undefined,
    format: (si: number) => string,
    t: (key: string, options?: Record<string, string>) => string,
): Status {
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

// Resultados do projeto ativo, calculados pelo motor.
export function ResultsPanel() {
    const { t } = useTranslation(['workbench', 'engine']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const boxType = useActiveProject((state) => state.data.box.type);
    const { results, warnings } = useActiveSimulation();
    const velocityUnit: UnitId = defaultUnitFor('velocity', unitSystem);
    const sixth = boxType === 'bandpass6';
    const plotted = useSimulations();
    const formatVelocity = (si: number) =>
        formatWithUnit(si, velocityUnit, locale);
    // Com um projeto o painel começa aberto (são poucos números). Com vários vira uma tabela alta
    // que empurra o gráfico para baixo, então começa recolhido; o título leva o resumo. Abrir ou
    // fechar à mão vale até o número de projetos cruzar entre um e vários.
    const multiple = plotted.length > 1;
    const [choice, setChoice] = useState<{
        multiple: boolean;
        open: boolean;
    }>();
    const open =
        choice !== undefined && choice.multiple === multiple
            ? choice.open
            : !multiple;
    const setOpen = (next: boolean) => setChoice({ multiple, open: next });
    const headline = twoChambers(boxType)
        ? undefined
        : results.f3_hz === undefined
          ? undefined
          : `${t('results.f3')} ${formatWithUnit(results.f3_hz, 'Hz', locale)}`;
    const summary = multiple
        ? t('results.compared', { count: plotted.length })
        : headline;

    return (
        <Panel
            region="results"
            title={t('regions.results')}
            collapsible={{ open, onOpenChange: setOpen, summary }}
        >
            {multiple ? (
                <ResultsTable items={plotted} />
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-5 gap-y-3">
                    {twoChambers(boxType) ? (
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
                            {sixth && (
                                <ValueTile
                                    label={t('results.fbRear')}
                                    valueSi={results.fb_rear_hz}
                                    unit="Hz"
                                />
                            )}
                            <ValueTile
                                label={t(
                                    sixth
                                        ? 'results.portLengthFront'
                                        : 'results.portLength',
                                )}
                                valueSi={results.port_length_m}
                                unit={defaultUnitFor('length', unitSystem)}
                                {...lengthStatus(
                                    warnings,
                                    t,
                                    sixth ? 'front' : undefined,
                                )}
                            />
                            <ValueTile
                                label={t(
                                    sixth
                                        ? 'results.portVelocityFront'
                                        : 'results.portVelocity',
                                )}
                                valueSi={results.port_velocity_max_ms}
                                unit={velocityUnit}
                                {...velocityStatus(
                                    results.port_velocity_max_ms,
                                    formatVelocity,
                                    t,
                                )}
                            />
                            {sixth && (
                                <>
                                    <ValueTile
                                        label={t('results.portLengthRear')}
                                        valueSi={results.port_rear_length_m}
                                        unit={defaultUnitFor(
                                            'length',
                                            unitSystem,
                                        )}
                                        {...lengthStatus(warnings, t, 'rear')}
                                    />
                                    <ValueTile
                                        label={t('results.portVelocityRear')}
                                        valueSi={
                                            results.port_rear_velocity_max_ms
                                        }
                                        unit={velocityUnit}
                                        {...velocityStatus(
                                            results.port_rear_velocity_max_ms,
                                            formatVelocity,
                                            t,
                                        )}
                                    />
                                </>
                            )}
                        </>
                    )}
                    {/* Volume que a simulação usa: o digitado menos alto-falante e dutos. */}
                    {boxType === 'bandpass' || sixth ? (
                        <>
                            <ValueTile
                                label={t('results.netRear')}
                                valueSi={results.net_rear_m3}
                                unit={defaultUnitFor('volume', unitSystem)}
                            />
                            <ValueTile
                                label={t('results.netFront')}
                                valueSi={results.net_front_m3}
                                unit={defaultUnitFor('volume', unitSystem)}
                            />
                        </>
                    ) : (
                        <ValueTile
                            label={t('results.net')}
                            valueSi={results.net_volume_m3}
                            unit={defaultUnitFor('volume', unitSystem)}
                        />
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
