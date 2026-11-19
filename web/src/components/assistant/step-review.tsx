import { ClipboardCheck, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ChartPanel } from '@/components/workbench/chart-panel';
import type { ChartKind } from '@/components/workbench/chart-panel';
import { EngineWarnings } from '@/components/workbench/engine-warnings';
import { resolveCutPlan } from '@/cutplan';
import { deriveDriver } from '@/engine';
import type { DriverKey } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { simulationOf } from '@/hooks/use-simulation';
import { PARAMETERS } from '@/lib/parameters';
import { formatQuantity, formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

type Row = { label: string; value: string | undefined };

const DRIVER_ROWS: DriverKey[] = [
    'fs_hz',
    'qts',
    'vas_m3',
    're_ohm',
    'sd_m2',
    'xmax_m',
    'pe_w',
];

type StepReviewProps = {
    onEdit: (step: 'driver' | 'box') => void;
};

// Passo 3: tudo o que foi preenchido, os números principais e o gráfico, com o pedido de conferir
// antes de cortar. Daqui dá para voltar a um passo e ajustar.
export function StepReview({ onEdit }: StepReviewProps) {
    const { t } = useTranslation(['assistant', 'workbench']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const data = useActiveProject((state) => state.data);
    const cutPlan = useCutPlan();
    const [chart, setChart] = useState<ChartKind>('response');
    const { values } = deriveDriver(data.driver);
    const { results } = simulationOf(data);
    const unitOf = (key: keyof typeof PARAMETERS): UnitId =>
        data.fieldUnits[key] ??
        defaultUnitFor(PARAMETERS[key].quantity, unitSystem);
    const show = (si: number | undefined, unit: UnitId) =>
        si === undefined ? undefined : formatWithUnit(si, unit, locale);
    const length = defaultUnitFor('length', unitSystem);
    const source = data.driverSource;
    const name = [source?.brand, source?.model, source?.variant]
        .filter((part) => part !== undefined)
        .join(' ');
    const vented = data.box.type === 'vented';
    const external =
        cutPlan.status === 'ready'
            ? cutPlan.plan.dimensions.external
            : undefined;

    const driverRows: Row[] = [
        {
            label: t('assistant:review.name'),
            value: name === '' ? undefined : name,
        },
        ...DRIVER_ROWS.map((key) => ({
            label: PARAMETERS[key].symbol,
            value: show(values[key].value, unitOf(key)),
        })),
    ];
    const boxRows: Row[] = [
        {
            label: t('assistant:review.type'),
            value: t(`workbench:boxType.${data.box.type}`),
        },
        {
            label: t('assistant:review.count'),
            value: String(data.drivers.count),
        },
        { label: 'Vb', value: show(data.box.vb_m3, unitOf('vb_m3')) },
        {
            label: t('assistant:review.external'),
            value:
                external === undefined
                    ? undefined
                    : `${[external.w_m, external.h_m, external.d_m]
                          .map((si) => formatQuantity(si, length, locale))
                          .join(' × ')} ${findUnit(length).symbol}`,
        },
        {
            label: t('assistant:review.thickness'),
            value: show(
                resolveCutPlan(data.cutPlan).thickness_m,
                unitOf('thickness_m'),
            ),
        },
        ...(vented
            ? [
                  { label: 'Fb', value: show(data.box.fb_hz, 'Hz') },
                  {
                      label: t('assistant:review.port'),
                      value:
                          data.box.port.shape === 'round' &&
                          data.box.port.diameter_m !== undefined &&
                          results.port_length_m !== undefined
                              ? t('assistant:review.portValue', {
                                    count: data.box.port.count,
                                    diameter: show(
                                        data.box.port.diameter_m,
                                        unitOf('diameter_m'),
                                    ),
                                    length: show(results.port_length_m, length),
                                })
                              : show(results.port_length_m, length),
                  },
              ]
            : []),
        {
            label: t('assistant:review.power'),
            value: show(data.signal.power_w, 'W'),
        },
    ];

    return (
        <div className="flex flex-col gap-5">
            <Banner icon={ClipboardCheck}>{t('assistant:review.check')}</Banner>
            <div className="grid gap-4 md:grid-cols-2">
                <Summary
                    title={t('assistant:steps.driver')}
                    rows={driverRows}
                    onEdit={() => onEdit('driver')}
                />
                <Summary
                    title={t('assistant:steps.box')}
                    rows={boxRows}
                    onEdit={() => onEdit('box')}
                />
            </div>
            <EngineWarnings />
            {/* Altura definida: o gráfico mede o contêiner ao montar, e no modal não há coluna
                de altura fixa como na bancada para o flex esticar. */}
            <div className="flex h-[28rem] flex-col [&>section]:flex-1">
                <ChartPanel selected={chart} onSelectedChange={setChart} />
            </div>
        </div>
    );
}

function Summary({
    title,
    rows,
    onEdit,
}: {
    title: string;
    rows: Row[];
    onEdit: () => void;
}) {
    const { t } = useTranslation('assistant');

    return (
        <section
            aria-label={title}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4"
        >
            <header className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{title}</h2>
                <Button variant="quiet" onPress={onEdit} className="text-xs">
                    <Pencil aria-hidden="true" className="size-3.5" />
                    {t('review.edit')}
                </Button>
            </header>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                {rows.map((row) => (
                    <div key={row.label} className="contents">
                        <dt className="text-muted">{row.label}</dt>
                        <dd className="truncate text-right tabular-nums">
                            {row.value ?? (
                                <span className="text-muted">
                                    {t('review.empty')}
                                </span>
                            )}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
