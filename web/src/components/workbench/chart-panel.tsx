import { Download } from 'lucide-react';
import { Suspense, lazy, useId, useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Tabs } from '@/components/ui/tabs';
import {
    ANALYSIS_MAX_HZ,
    CHART_MAX_HZ,
    PORT_VELOCITY_ERROR_MS,
    PORT_VELOCITY_WARN_MS,
    twoChambers,
} from '@/engine';
import type { CurveId, FieldKey } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useSimulations } from '@/hooks/use-simulation';
import type { ProjectSimulation } from '@/hooks/use-simulation';
import type { ExportInput, ExportProject } from '@/lib/chart-export/types';
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
const ChartExportDialog = lazy(() => import('./chart-export-dialog'));

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

// O que desenha um gráfico: serve ao `ChartFrame` na tela e à exportação em imagem.
export type ChartView = {
    kind: ChartKind;
    title: string;
    xLabel: string;
    yLabel: string;
    frequencies: readonly number[];
    series: ChartSeries[];
    limits: ChartLimit[];
    yRange?: [number, number];
    yIncrs?: number[];
    xRange: [number, number];
    formatValue: (value: number) => string;
    formatFrequency: (hz: number) => string;
};

const CURVES: Record<ChartKind, { curve: CurveId; quantity: QuantityId }> = {
    response: { curve: 'spl_db', quantity: 'level' },
    excursion: { curve: 'excursion_m', quantity: 'length' },
    impedance: { curve: 'impedance_ohm', quantity: 'resistance' },
    groupDelay: { curve: 'group_delay_s', quantity: 'time' },
    portVelocity: { curve: 'port_velocity_ms', quantity: 'velocity' },
};

const MIN_HZ = 10;

// Até onde o gráfico vai (Hz). 1 kHz é a faixa em que o modelo e os resultados valem; acima
// disso as curvas são o mesmo modelo estendido, só para olhar.
const RANGE_MAX_OPTIONS = [200, ANALYSIS_MAX_HZ, 5000, 10000, CHART_MAX_HZ];
const RANGE_SHORT: Record<number, string> = {
    200: '200',
    1000: '1k',
    5000: '5k',
    10000: '10k',
    20000: '20k',
};
const RANGE_NAME: Record<number, string> = {
    200: '200 Hz',
    1000: '1 kHz',
    5000: '5 kHz',
    10000: '10 kHz',
    20000: '20 kHz',
};

// Faixa da resposta: 42 dB de janela com o topo logo acima do maior valor visível.
function levelRange(
    series: ChartSeries[],
    frequencies: readonly number[],
    [min, max]: [number, number],
): [number, number] {
    const values = series
        .flatMap((item) =>
            item.values.filter((_, index) => {
                const frequency = frequencies[index];

                return frequency >= min && frequency <= max;
            }),
        )
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
    // Até quantos Hz o gráfico vai, e o zoom por arrastar (sobrepõe a faixa até voltar).
    const [maxHz, setMaxHz] = useState(ANALYSIS_MAX_HZ);
    const exportHintId = useId();
    const [zoom, setZoom] = useState<[number, number] | null>(null);
    // Gráfico congelado quando o diálogo de exportação abre; fechado = nulo.
    const [exporting, setExporting] = useState<ExportInput | null>(null);
    const xRange: [number, number] = zoom ?? [MIN_HZ, maxHz];
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

    // O gráfico da aba `kind` como a tela e a exportação o desenham: uma montagem só,
    // para a imagem exportada nunca divergir do que está na bancada.
    const viewFor = (kind: ChartKind): ChartView => {
        const series = seriesFor(kind);
        const frequencies = plotted[0]?.simulation.frequencies_hz ?? [];
        const normalized = plotted.some(
            ({ simulation }) => simulation.spl_normalized,
        );

        return {
            kind,
            title: t(`charts.${kind}`),
            xLabel: t('charts.frequency'),
            yLabel: yLabel(kind, normalized),
            frequencies,
            series,
            limits: series.length > 0 ? limitsFor(kind) : [],
            yRange:
                kind === 'response'
                    ? normalized
                        ? [-36, 6]
                        : levelRange(series, frequencies, xRange)
                    : undefined,
            yIncrs: kind === 'response' ? [3, 6, 12] : undefined,
            xRange,
            formatValue: valueFormatter(kind),
            formatFrequency: (hz) => formatWithUnit(hz, 'Hz', locale),
        };
    };

    // Dados do projeto que a legenda da imagem mostra: tudo já na locale e nas unidades
    // da bancada.
    const exportProject = (
        { project, simulation }: ProjectSimulation,
        kind: ChartKind,
    ): ExportProject => {
        const { data } = project;
        const { results } = simulation;
        const volumeUnit = unitFor('volume');
        const hertz = (value?: number) =>
            value === undefined
                ? undefined
                : formatWithUnit(value, 'Hz', locale);
        const liters = (value?: number) =>
            value === undefined
                ? undefined
                : formatWithUnit(value, volumeUnit, locale);
        const bandpass = twoChambers(data.box.type);
        const source = data.driverSource;
        const signal =
            data.signal.mode === 'voltage'
                ? results.voltage_v === undefined
                    ? undefined
                    : formatWithUnit(results.voltage_v, 'V', locale)
                : results.power_w === undefined
                  ? undefined
                  : formatWithUnit(results.power_w, 'W', locale);
        const rear =
            kind === 'portVelocity' &&
            simulation.curves.port_rear_velocity_ms !== undefined;

        return {
            id: project.id,
            name: displayName(project, t),
            color: project.color,
            seriesIds: rear ? [project.id, `${project.id}-rear`] : [project.id],
            box: {
                type: t(`boxType.${data.box.type}`),
                volume: bandpass
                    ? [
                          liters(results.net_rear_m3) === undefined
                              ? undefined
                              : `${t('charts.seriesRear')} ${liters(results.net_rear_m3)}`,
                          liters(results.net_front_m3) === undefined
                              ? undefined
                              : `${t('charts.seriesFront')} ${liters(results.net_front_m3)}`,
                      ]
                          .filter((part) => part !== undefined)
                          .join(' / ')
                    : (liters(results.net_volume_m3) ?? ''),
                tuning: [hertz(results.fb_hz), hertz(results.fb_rear_hz)]
                    .filter((part) => part !== undefined)
                    .join(' / '),
            },
            driver: [source?.brand, source?.model, source?.variant]
                .filter((part) => part !== undefined && part !== '')
                .join(' '),
            signal: signal ?? '',
            bandpass,
            cutoffs: {
                f3_hz: results.f3_hz,
                f3_below_range: results.f3_below_range,
                f10_hz: results.f10_hz,
                f10_below_range: results.f10_below_range,
                f_low_hz: results.f_low_hz,
                f_high_hz: results.f_high_hz,
                f_low_below_range: results.f_low_below_range,
                f_high_above_range: results.f_high_above_range,
                f_low10_hz: results.f_low10_hz,
                f_high10_hz: results.f_high10_hz,
                f_low10_below_range: results.f_low10_below_range,
                f_high10_above_range: results.f_high10_above_range,
            },
        };
    };

    // Congela o gráfico aberto, com o zoom e a faixa de agora, para a exportação.
    const openExport = () => {
        const view = viewFor(current);

        setExporting({
            ...view,
            projects: plotted.map((item) => exportProject(item, current)),
            locale,
            date: new Date(),
            labels: {
                peak: t('charts.peak'),
                f3: t('charts.export.labels.f3'),
                f10: t('charts.export.labels.f10'),
                tuning: t('charts.export.labels.fb'),
                belowRange: t('charts.export.labels.belowRange', {
                    value: formatWithUnit(MIN_HZ, 'Hz', locale),
                }),
                aboveRange: t('charts.export.labels.aboveRange', {
                    value: formatWithUnit(ANALYSIS_MAX_HZ, 'Hz', locale),
                }),
                none: '—',
                exceeded: t('charts.export.labels.exceeded'),
                within: t('charts.export.labels.within'),
                front: t('charts.seriesFront'),
                rear: t('charts.seriesRear'),
                more: (count) => t('charts.export.labels.more', { count }),
            },
        });
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

    // Seções "Mostrar mais" recolhidas que guardam algum campo que falta: a mensagem
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

    const noCurve = seriesFor(current).length === 0;

    return (
        <Panel
            region="charts"
            title={t('regions.charts')}
            className="min-h-96"
            actions={
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                    <Button
                        variant="secondary"
                        className="h-7 px-2 text-xs"
                        disabled={noCurve}
                        // O nome completo separa este botão do "Exportar" do projeto na barra.
                        aria-label={t('charts.export.title')}
                        aria-describedby={noCurve ? exportHintId : undefined}
                        onPress={openExport}
                    >
                        <Download aria-hidden="true" className="size-3.5" />
                        <span>{t('charts.export.button')}</span>
                    </Button>
                    {noCurve && (
                        <span id={exportHintId} className="sr-only">
                            {t('charts.export.disabled')}
                        </span>
                    )}
                    {zoom !== null && (
                        <Button
                            variant="quiet"
                            className="h-7 px-2 text-xs"
                            onPress={() => setZoom(null)}
                        >
                            {t('charts.zoomReset')}
                        </Button>
                    )}
                    <SegmentedControl<string>
                        label={t('charts.rangeLabel')}
                        size="sm"
                        selected={String(maxHz)}
                        onChange={(id) => {
                            setMaxHz(Number(id));
                            setZoom(null);
                        }}
                        options={RANGE_MAX_OPTIONS.map((hz) => ({
                            id: String(hz),
                            label: t('charts.rangeUpTo', {
                                value: RANGE_NAME[hz],
                            }),
                            short: RANGE_SHORT[hz],
                        }))}
                    />
                </div>
            }
        >
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
                    const view = viewFor(kind);
                    const series = view.series;
                    const first = plotted[0];
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
                        // Só a aba escolhida fica montada: cada troca remonta o painel e reapresenta a
                        // entrada (legenda em fade, gráfico em varredura).
                        <div className="flex h-full swap flex-col">
                            <ChartLegend
                                items={plotted.length > 1 ? legend : []}
                            />
                            <div className="relative h-80 pt-3 xl:h-auto xl:min-h-72 xl:flex-1">
                                <div className="h-full chart-sweep">
                                    <Suspense>
                                        <ChartFrame
                                            xLabel={view.xLabel}
                                            yLabel={view.yLabel}
                                            label={view.title}
                                            formatValue={view.formatValue}
                                            formatFrequency={
                                                view.formatFrequency
                                            }
                                            frequencies={view.frequencies}
                                            series={view.series}
                                            limits={view.limits}
                                            yRange={view.yRange}
                                            yIncrs={view.yIncrs}
                                            xRange={view.xRange}
                                            onZoom={setZoom}
                                            onZoomReset={() => setZoom(null)}
                                            peakLabel={t('charts.peak')}
                                        />
                                    </Suspense>
                                </div>
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
            {exporting !== null && (
                <Suspense>
                    <ChartExportDialog
                        open
                        onOpenChange={(open) => !open && setExporting(null)}
                        input={exporting}
                    />
                </Suspense>
            )}
            {!anyPorted && (
                <p className="text-[11px] text-muted">
                    {t('charts.portVelocity')}: {t('engine:charts.noPort')}
                </p>
            )}
        </Panel>
    );
}
