import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { twoChambers } from '@/engine';
import type { SimulationResults } from '@/engine';
import type { ProjectSimulation } from '@/hooks/use-simulation';
import { displayName } from '@/lib/project/names';
import { formatQuantity } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { SWATCH } from './swatch';

type Row = {
    key: string;
    label: string;
    unit: UnitId;
    value: (results: SimulationResults) => number | undefined;
};

// Resultados lado a lado de 2–3 projetos plotados, o ativo primeiro.
export function ResultsTable({ items }: { items: ProjectSimulation[] }) {
    const { t } = useTranslation(['workbench', 'project']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);

    // Bandpass de 6ª ordem plotada: o duto frontal ganha o complemento e entram as linhas do traseiro.
    const sixthPlotted = items.some(
        ({ project }) => project.data.box.type === 'bandpass6',
    );
    const bandpassPlotted = items.some(({ project }) =>
        twoChambers(project.data.box.type),
    );

    const rows: Row[] = [
        {
            key: 'fLow',
            label: t('results.fLow'),
            unit: 'Hz',
            value: (r) => r.f_low_hz,
        },
        {
            key: 'fHigh',
            label: t('results.fHigh'),
            unit: 'Hz',
            value: (r) => r.f_high_hz,
        },
        {
            key: 'fCenter',
            label: t('results.fCenter'),
            unit: 'Hz',
            value: (r) => r.f_center_hz,
        },
        {
            key: 'bandwidth',
            label: t('results.bandwidth'),
            unit: 'oct',
            value: (r) => r.bandwidth_oct,
        },
        {
            key: 'peak',
            label: t('results.peak'),
            unit: 'dB',
            value: (r) => r.peak_db,
        },
        {
            key: 'f3',
            label: t('results.f3'),
            unit: 'Hz',
            value: (r) => r.f3_hz,
        },
        {
            key: 'qtc',
            label: t('results.qtc'),
            unit: 'none',
            value: (r) => r.qtc,
        },
        {
            key: 'fc',
            label: t('results.fc'),
            unit: 'Hz',
            value: (r) => r.fc_hz,
        },
        {
            key: 'fb',
            label: t('results.fb'),
            unit: 'Hz',
            value: (r) => r.fb_hz,
        },
        {
            key: 'portLength',
            label: t(
                sixthPlotted ? 'results.portLengthFront' : 'results.portLength',
            ),
            unit: defaultUnitFor('length', unitSystem),
            value: (r) => r.port_length_m,
        },
        // Volume líquido: o número que WinISD, AJ e outras calculadoras pedem como "Vb" (elas não
        // descontam o duto); o BuildBass recebe o bruto e desconta driver e duto.
        {
            key: 'netVolume',
            label: t(
                bandpassPlotted
                    ? 'results.netVolumeFront'
                    : 'results.netVolume',
            ),
            unit: defaultUnitFor('volume', unitSystem),
            value: (r) => r.net_volume_m3 ?? r.net_front_m3,
        },
        {
            key: 'portVolume',
            label: t(
                sixthPlotted ? 'results.portVolumeFront' : 'results.portVolume',
            ),
            unit: defaultUnitFor('volume', unitSystem),
            value: (r) => r.port_volume_m3,
        },
        {
            key: 'portPipe',
            label: t(
                sixthPlotted ? 'results.portPipeFront' : 'results.portPipe',
            ),
            unit: 'Hz',
            value: (r) => r.port_pipe_hz,
        },
        {
            key: 'portVelocity',
            label: t(
                sixthPlotted
                    ? 'results.portVelocityFront'
                    : 'results.portVelocity',
            ),
            unit: defaultUnitFor('velocity', unitSystem),
            value: (r) => r.port_velocity_max_ms,
        },
        {
            key: 'fbRear',
            label: t('results.fbRear'),
            unit: 'Hz',
            value: (r) => r.fb_rear_hz,
        },
        {
            key: 'portLengthRear',
            label: t('results.portLengthRear'),
            unit: defaultUnitFor('length', unitSystem),
            value: (r) => r.port_rear_length_m,
        },
        {
            key: 'portVolumeRear',
            label: t('results.portVolumeRear'),
            unit: defaultUnitFor('volume', unitSystem),
            value: (r) => r.port_rear_volume_m3,
        },
        {
            key: 'portPipeRear',
            label: t('results.portPipeRear'),
            unit: 'Hz',
            value: (r) => r.port_rear_pipe_hz,
        },
        {
            key: 'portVelocityRear',
            label: t('results.portVelocityRear'),
            unit: defaultUnitFor('velocity', unitSystem),
            value: (r) => r.port_rear_velocity_max_ms,
        },
        {
            key: 'xmaxPower',
            label: t('results.xmaxPower'),
            unit: 'W',
            value: (r) => r.xmax_power_w,
        },
        {
            key: 'spl0',
            label: t('results.spl0'),
            unit: 'dB',
            value: (r) => r.spl0_db,
        },
        {
            key: 'efficiency',
            label: t('results.efficiency'),
            unit: 'percent',
            value: (r) => r.efficiency,
        },
    ];

    // Linhas da bandpass só aparecem se algum projeto plotado a tem (as do F3 e da selada/dutada
    // continuam sempre, como antes).
    const BANDPASS_ROWS = ['fLow', 'fHigh', 'fCenter', 'bandwidth', 'peak'];
    const REAR_ROWS = [
        'fbRear',
        'portLengthRear',
        'portVolumeRear',
        'portPipeRear',
        'portVelocityRear',
    ];
    const shown = (row: Row) =>
        (bandpassPlotted || !BANDPASS_ROWS.includes(row.key)) &&
        (sixthPlotted || !REAR_ROWS.includes(row.key));

    // Corte fora da grade de cálculo: texto no lugar do número.
    const outOfRange = (key: string, results: SimulationResults) => {
        if (key === 'f3' && results.f3_below_range) {
            return t('results.belowRange');
        }

        if (key === 'fLow' && results.f_low_below_range) {
            return t('results.belowRange');
        }

        if (key === 'fHigh' && results.f_high_above_range) {
            return t('results.aboveRange');
        }

        return undefined;
    };

    return (
        // Com 3 projetos a tabela pode rolar na horizontal: a área precisa receber foco para rolar
        // pelo teclado.
        <div
            role="region"
            aria-label={t('results.comparison')}
            tabIndex={0}
            className="overflow-x-auto rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-solid"
        >
            <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="border-b border-border">
                        <th scope="col" className="py-1.5 pr-2 text-left">
                            <span className="sr-only">
                                {t('regions.results')}
                            </span>
                        </th>
                        {items.map(({ project, active }) => (
                            <th
                                key={project.id}
                                scope="col"
                                className={cn(
                                    'px-2 py-1.5 text-right font-medium whitespace-nowrap',
                                    active ? 'text-foreground' : 'text-muted',
                                )}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'size-2.5 shrink-0 rounded-full',
                                            SWATCH[project.color],
                                        )}
                                    />
                                    {displayName(project, t)}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.filter(shown).map((row) => (
                        <tr key={row.key} className="border-b border-border/60">
                            <th
                                scope="row"
                                className="py-1.5 pr-2 text-left text-xs font-normal text-muted"
                            >
                                {row.label}
                                {findUnit(row.unit).symbol !== '' &&
                                    ` (${findUnit(row.unit).symbol})`}
                            </th>
                            {items.map(({ project, simulation }) => {
                                const value = row.value(simulation.results);

                                return (
                                    <td
                                        key={project.id}
                                        className="px-2 py-1.5 text-right num"
                                    >
                                        {outOfRange(
                                            row.key,
                                            simulation.results,
                                        ) ??
                                            formatQuantity(
                                                value,
                                                row.unit,
                                                locale,
                                            )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
