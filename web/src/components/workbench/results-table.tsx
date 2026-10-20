import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
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

// Resultados lado a lado de 2–3 projetos plotados, o ativo primeiro (FR-021d).
export function ResultsTable({ items }: { items: ProjectSimulation[] }) {
    const { t } = useTranslation(['workbench', 'project']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);

    const rows: Row[] = [
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
            label: t('results.portLength'),
            unit: defaultUnitFor('length', unitSystem),
            value: (r) => r.port_length_m,
        },
        {
            key: 'portVelocity',
            label: t('results.portVelocity'),
            unit: defaultUnitFor('velocity', unitSystem),
            value: (r) => r.port_velocity_max_ms,
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
                                            SWATCH[project.slot],
                                        )}
                                    />
                                    {displayName(project, t)}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
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
                                        {row.key === 'f3' &&
                                        simulation.results.f3_below_range
                                            ? t('results.belowRange')
                                            : formatQuantity(
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
