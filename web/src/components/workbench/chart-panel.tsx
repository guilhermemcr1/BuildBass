import { Suspense, lazy, useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { PORT_VELOCITY_ERROR_MS, PORT_VELOCITY_WARN_MS } from '@/engine';
import type { CurveId, FieldKey } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useSimulations } from '@/hooks/use-simulation';
import type { ProjectSimulation } from '@/hooks/use-simulation';
import { PARAMETERS, sectionOf } from '@/lib/parameters';
import type { SectionId } from '@/lib/parameters';
import { displayName } from '@/lib/project/names';
import { fromSi } from '@/lib/units/convert';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import type { QuantityId, UnitId } from '@/lib/units/quantities';
import { useExpanded } from '@/stores/expanded';
import { usePreferences } from '@/stores/preferences';
import { ChartLegend } from './chart-legend';
import type { ChartLimit, ChartSeries } from './chart-frame';
import { Panel } from './panel';

const ChartFrame = lazy(() => import('./chart-frame'));

export type ChartKind =
    | 'response'
    | 'excursion'
    | 'impedance'
    | 'groupDelay'
    | 'portVelocity';

export const CHART_KINDS: ChartKind[] = [
    'response',
    'excursion',
    'impedance',
    'groupDelay',
    'portVelocity',
];

const CURVES: Record<ChartKind, { curve: CurveId; quantity: QuantityId }> = {
    response: { curve: 'spl_db', quantity: 'level' },
    excursion: { curve: 'excursion_m', quantity: 'length' },
    impedance: { curve: 'impedance_ohm', quantity: 'resistance' },
    groupDelay: { curve: 'group_delay_s', quantity: 'time' },
    portVelocity: { curve: 'port_velocity_ms', quantity: 'velocity' },
};

// Faixa da resposta: 42 dB de janela com o topo logo acima do maior valor.
function levelRange(series: ChartSeries[]): [number, number] {
    const values = series
        .flatMap((item) => item.values)
        .filter((v) => v !== null);
    const top = Math.ceil((Math.max(...values, 0) + 3) / 6) * 6;

    return [top - 42, top];
}

type ChartPanelProps = {
    selected?: ChartKind;
    onSelectedChange?: (kind: ChartKind) => void;
    // Limites desenhados em cada aba (Xmax, velocidade do ar).
    limits?: Partial<Record<ChartKind, ChartLimit[]>>;
};

export function ChartPanel({
    selected,
    onSelectedChange,
    limits = {},
}: ChartPanelProps) {
    const { t } = useTranslation(['workbench', 'engine', 'project']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const open = useExpanded((state) => state.open);
    const expand = useExpanded((state) => state.expand);
    const plotted = useSimulations();
    const xmax = useActiveProject((state) => state.data.driver.xmax_m);
    const [localSelected, setLocalSelected] = useState<ChartKind>('response');
    const anyPorted = plotted.some(
        ({ project }) => project.data.box.type !== 'closed',
    );
    const requested = selected ?? localSelected;
    const current =
        requested === 'portVelocity' && !anyPorted ? 'response' : requested;

    const listFormat = new Intl.ListFormat(locale, {
        style: 'long',
        type: 'conjunction',
    });

    const unitFor = (quantity: QuantityId): UnitId =>
        defaultUnitFor(quantity, unitSystem);

    // Limites fixos: Xmax do projeto ativo e velocidade do ar, somados aos que vêm de fora.
    const limitsFor = (kind: ChartKind): ChartLimit[] => {
        if (kind === 'excursion') {
            const unit = unitFor('length');

            return [
                ...(limits[kind] ?? []),
                ...(xmax === undefined || xmax <= 0
                    ? []
                    : [
                          {
                              value: fromSi(xmax, unit),
                              tone: 'warn' as const,
                              label: t('engine:limits.xmax', {
                                  value: formatWithUnit(xmax, unit, locale),
                              }),
                              highlight: true,
                          },
                      ]),
            ];
        }

        if (kind !== 'portVelocity') {
            return limits[kind] ?? [];
        }

        const unit = unitFor('velocity');
        const limit = (
            si: number,
            tone: ChartLimit['tone'],
            key: 'portWarn' | 'portError',
        ): ChartLimit => ({
            value: fromSi(si, unit),
            tone,
            label: t(`engine:limits.${key}`, {
                value: formatWithUnit(si, unit, locale),
            }),
        });

        return [
            ...(limits[kind] ?? []),
            limit(PORT_VELOCITY_WARN_MS, 'warn', 'portWarn'),
            limit(PORT_VELOCITY_ERROR_MS, 'error', 'portError'),
        ];
    };

    const seriesFor = (kind: ChartKind): ChartSeries[] => {
        const { curve, quantity } = CURVES[kind];
        const unit = unitFor(quantity);

        const convert = (values: readonly number[]) =>
            values.map((si) => (Number.isFinite(si) ? fromSi(si, unit) : null));

        return plotted.flatMap(({ project, active, simulation }) => {
            const values = simulation.curves[curve];

            if (values === undefined) {
                return [];
            }

            const name = displayName(project, t);
            const common = {
                color: project.color,
                emphasis: active && plotted.length > 1,
            };
            // Bandpass de 6ª ordem: o duto traseiro vira uma segunda série, tracejada, na cor do
            // projeto; só então a contínua ganha o complemento "frontal".
            const rear =
                kind === 'portVelocity'
                    ? simulation.curves.port_rear_velocity_ms
                    : undefined;

            if (rear === undefined) {
                return [
                    {
                        ...common,
                        id: project.id,
                        label: name,
                        values: convert(values),
                    },
                ];
            }

            return [
                {
                    ...common,
                    id: project.id,
                    label: `${name} — ${t('charts.seriesFront')}`,
                    values: convert(values),
                },
                {
                    ...common,
                    id: `${project.id}-rear`,
                    label: `${name} — ${t('charts.seriesRear')}`,
                    values: convert(rear),
                    dashed: true,
                },
            ];
        });
    };

    const valueFormatter = (kind: ChartKind) => {
        const unit = unitFor(CURVES[kind].quantity);
        const { symbol, decimals } = findUnit(unit);
        const number = new Intl.NumberFormat(locale, {
            maximumFractionDigits: Math.max(decimals, 1),
            minimumFractionDigits: Math.max(decimals, 1),
        });

        return (value: number) => `${number.format(value)} ${symbol}`;
    };

    const yLabel = (kind: ChartKind, normalized: boolean): string => {
        const symbol = findUnit(unitFor(CURVES[kind].quantity)).symbol;

        switch (kind) {
            case 'response':
                return t(normalized ? 'charts.levelRelative' : 'charts.level');
            case 'excursion':
                return t('charts.excursionAxis', { unit: symbol });
            case 'impedance':
                return t('charts.impedanceAxis');
            case 'groupDelay':
                return t('charts.groupDelayAxis');
            case 'portVelocity':
                return t('charts.portVelocityAxis', { unit: symbol });
        }
    };

    const missingKeys = (
        first: ProjectSimulation,
        kind: ChartKind,
    ): FieldKey[] => [
        ...new Set([
            ...first.simulation.missing[CURVES[kind].curve],
            // Na 6ª ordem faltam também as medidas do duto traseiro.
            ...(kind === 'portVelocity' &&
            first.project.data.box.type === 'bandpass6'
                ? first.simulation.missing.port_rear_velocity_ms
                : []),
        ]),
    ];

    // Seções "Mostrar mais" recolhidas que guardam algum campo que falta (FR-031a): a mensagem
    // oferece abri-las em vez de deixar o usuário procurar.
    const hiddenSections = (missing: FieldKey[]): SectionId[] => [
        ...new Set(
            missing
                .map((key) => sectionOf(key))
                .filter(
                    (section): section is SectionId =>
                        section !== undefined && !open[section],
                ),
        ),
    ];

    return (
        <Panel region="charts" title={t('regions.charts')} className="min-h-96">
            <Tabs<ChartKind>
                label={t('charts.label')}
                items={CHART_KINDS.map((id) => ({
                    id,
                    label: t(`charts.${id}`),
                    disabled: id === 'portVelocity' && !anyPorted,
                }))}
                selected={current}
                onChange={(kind) => {
                    setLocalSelected(kind);
                    onSelectedChange?.(kind);
                }}
                className="flex-1"
            >
                {(kind) => {
                    const series = seriesFor(kind);
                    const first = plotted[0];
                    const normalized = plotted.some(
                        ({ simulation }) => simulation.spl_normalized,
                    );
                    const missingFields =
                        first === undefined ? [] : missingKeys(first, kind);
                    const missing =
                        missingFields.length === 0
                            ? undefined
                            : listFormat.format(
                                  missingFields.map(
                                      (key) => PARAMETERS[key].symbol,
                                  ),
                              );
                    const hidden = hiddenSections(missingFields);
                    const legend = plotted.map(
                        ({ project, active, simulation }) => ({
                            id: project.id,
                            label: displayName(project, t),
                            color: project.color,
                            emphasis: active && plotted.length > 1,
                            empty:
                                simulation.curves[CURVES[kind].curve] ===
                                undefined,
                        }),
                    );

                    return (
                        <div className="flex h-full flex-col">
                            <ChartLegend
                                items={plotted.length > 1 ? legend : []}
                            />
                            <div className="relative h-80 pt-3 xl:h-auto xl:min-h-72 xl:flex-1">
                                <Suspense>
                                    <ChartFrame
                                        xLabel={t('charts.frequency')}
                                        yLabel={yLabel(kind, normalized)}
                                        label={t(`charts.${kind}`)}
                                        formatValue={valueFormatter(kind)}
                                        formatFrequency={(hz) =>
                                            formatWithUnit(hz, 'Hz', locale)
                                        }
                                        frequencies={
                                            first?.simulation.frequencies_hz ??
                                            []
                                        }
                                        series={series}
                                        limits={
                                            series.length > 0
                                                ? limitsFor(kind)
                                                : []
                                        }
                                        yRange={
                                            kind === 'response'
                                                ? normalized
                                                    ? [-36, 6]
                                                    : levelRange(series)
                                                : undefined
                                        }
                                        yIncrs={
                                            kind === 'response'
                                                ? [3, 6, 12]
                                                : undefined
                                        }
                                    />
                                </Suspense>
                                {series.length === 0 && (
                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                                        <div className="max-w-xs rounded-lg border border-border bg-surface/90 px-4 py-3 text-center">
                                            {first === undefined ? (
                                                <p className="text-sm text-muted">
                                                    {t('charts.nonePlotted')}
                                                </p>
                                            ) : (
                                                <>
                                                    <p className="text-sm font-semibold">
                                                        {t('charts.emptyTitle')}
                                                    </p>
                                                    {missing !== undefined && (
                                                        <p className="mt-1 text-sm text-muted">
                                                            {t(
                                                                'charts.emptyBody',
                                                                { missing },
                                                            )}
                                                        </p>
                                                    )}
                                                    {hidden.length > 0 && (
                                                        <Button
                                                            variant="secondary"
                                                            className="pointer-events-auto mt-2"
                                                            onPress={() =>
                                                                hidden.forEach(
                                                                    expand,
                                                                )
                                                            }
                                                        >
                                                            {t(
                                                                'charts.showField',
                                                                {
                                                                    count: missingFields.filter(
                                                                        (key) =>
                                                                            hidden.includes(
                                                                                sectionOf(
                                                                                    key,
                                                                                ) as SectionId,
                                                                            ),
                                                                    ).length,
                                                                },
                                                            )}
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                }}
            </Tabs>
            {!anyPorted && (
                <p className="text-[11px] text-muted">
                    {t('charts.portVelocity')}: {t('engine:charts.noPort')}
                </p>
            )}
        </Panel>
    );
}
