import { Download, Printer } from 'lucide-react';
import { useId, useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { InfoTip } from '@/components/ui/help-tip';
import { Tabs } from '@/components/ui/tabs';
import { ValueTile } from '@/components/ui/value-tile';
import { useActiveProject } from '@/hooks/use-active-project';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { useSheetLayout } from '@/hooks/use-sheet-layout';
import { csvFormatFor, downloadCutPlanCsv } from '@/lib/cut-plan-export';
import { planKeySymbol } from '@/lib/cut-plan-text';
import { displayName } from '@/lib/project/names';
import { formatQuantity } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { useWorkspace } from '@/stores/workspace';
import { CutDrawings } from './cut-drawings';
import { CutTotals } from './cut-totals';
import { Panel } from './panel';
import { PartsTable } from './parts-table';
import { PlanConfig } from './plan-config';
import { PlanWarnings } from './plan-warnings';
import { SheetLayout } from './sheet-layout';
import { VolumeCheck } from './volume-check';

type PlanView = 'drawings' | 'sheets';

type PlanPanelProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Imprimir é da bancada (ela esconde o resto e monta a folha); sem isso, imprime a página.
    onPrint?: () => void;
};

// Plano de corte do projeto ativo (specs/005): configuração, dimensões e lista de peças. Seção
// recolhível abaixo dos gráficos, com um resumo no título para valer a pena mesmo fechada.
export function PlanPanel({
    open,
    onOpenChange,
    onPrint = () => window.print(),
}: PlanPanelProps) {
    const { t } = useTranslation(['cutplan', 'project']);
    const reasonId = useId();
    const { locale } = useLocale();
    const [planView, setPlanView] = useState<PlanView>('drawings');
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unit = defaultUnitFor('length', unitSystem);
    const cutPlan = useCutPlan();
    const suggestion = useSheetLayout(
        cutPlan.status === 'ready' ? cutPlan.plan : undefined,
    );
    const project = useWorkspace((state) =>
        state.projects.find((p) => p.id === state.activeId),
    );
    const boxType = useActiveProject((state) => state.data.box.type);
    const name = project === undefined ? '' : displayName(project, t);
    const list = new Intl.ListFormat(locale, {
        style: 'long',
        type: 'conjunction',
    });
    const symbols = (keys: Parameters<typeof planKeySymbol>[0][]) =>
        list.format(keys.map((key) => planKeySymbol(key, t)));

    const ready = cutPlan.status === 'ready';
    const summary = ready
        ? [
              t('summary.pieces', {
                  count: cutPlan.plan.pieces.reduce(
                      (total, piece) => total + piece.quantity,
                      0,
                  ),
              }),
              [
                  cutPlan.plan.dimensions.external.w_m,
                  cutPlan.plan.dimensions.external.h_m,
                  cutPlan.plan.dimensions.external.d_m,
              ]
                  .map((si) => formatQuantity(si, unit, locale))
                  .join(' × ') + ` ${findUnit(unit).symbol}`,
          ].join(' · ')
        : t('summary.blocked');
    const actions = (
        <div className="flex items-center gap-1.5">
            <Button
                variant="secondary"
                disabled={!ready}
                aria-describedby={ready ? undefined : reasonId}
                onPress={() => {
                    if (cutPlan.status === 'ready') {
                        downloadCutPlanCsv(
                            cutPlan.plan,
                            project?.data.name ?? '',
                            csvFormatFor(locale, unitSystem, t),
                            suggestion?.layout,
                        );
                    }
                }}
            >
                <Download aria-hidden="true" className="size-4" />
                {t('actions.exportCsv')}
            </Button>
            <Button
                variant="secondary"
                disabled={!ready}
                aria-describedby={ready ? undefined : reasonId}
                onPress={onPrint}
            >
                <Printer aria-hidden="true" className="size-4" />
                {t('actions.print')}
            </Button>
            {!ready && (
                <span id={reasonId} className="sr-only">
                    {t('actions.unavailable')}
                </span>
            )}
        </div>
    );

    const dimensions =
        cutPlan.status === 'ready' ? (
            <section
                aria-label={t('dimensions.title')}
                className="flex flex-col gap-2.5 rounded-lg border border-border bg-raised/40 p-3"
            >
                <header className="flex items-center gap-1">
                    <h3 className="text-section">{t('dimensions.title')}</h3>
                    <InfoTip
                        content={t('config.help.dimensions')}
                        label={t('config.help.info', {
                            topic: t('dimensions.title'),
                        })}
                    />
                </header>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {(['internal', 'external'] as const).map((kind) => (
                        <div key={kind} className="flex flex-col gap-2">
                            {(
                                [
                                    ['width', 'w_m'],
                                    ['height', 'h_m'],
                                    ['depth', 'd_m'],
                                ] as const
                            ).map(([axis, key]) => (
                                <ValueTile
                                    key={axis}
                                    label={`${t(`dimensions.${kind}`)} · ${t(`dimensions.${axis}`)}`}
                                    valueSi={cutPlan.plan.dimensions[kind][key]}
                                    unit={unit}
                                />
                            ))}
                        </div>
                    ))}
                </div>
                {cutPlan.plan.dimensions.chambers !== undefined && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                        <ValueTile
                            label={t('dimensions.rearDepth')}
                            valueSi={cutPlan.plan.dimensions.chambers.rear_d_m}
                            unit={unit}
                        />
                        <ValueTile
                            label={t('dimensions.frontDepth')}
                            valueSi={cutPlan.plan.dimensions.chambers.front_d_m}
                            unit={unit}
                        />
                    </div>
                )}
            </section>
        ) : null;

    return (
        <Panel
            region="plan"
            title={t('title')}
            collapsible={{ open, onOpenChange, summary }}
        >
            <div className="flex justify-end">{actions}</div>
            {/* Configuração e dimensões numa coluna estreita; totais, peças e conferências ao lado. Os
                campos não esticam mais pela largura inteira do painel. */}
            <div className="grid gap-x-8 gap-y-5 lg:grid-cols-[minmax(16rem,21rem)_minmax(0,1fr)] lg:items-start">
                <div className="flex min-w-0 flex-col gap-4">
                    <PlanConfig />
                    {dimensions}
                </div>
                <div className="flex min-w-0 swap flex-col gap-5">
                    {cutPlan.status === 'blocked' ? (
                        <div className="flex flex-col gap-2">
                            {cutPlan.missing.length > 0 && (
                                <Banner tone="info">
                                    {t('missing', {
                                        missing: symbols(cutPlan.missing),
                                    })}
                                </Banner>
                            )}
                            {cutPlan.invalid.length > 0 && (
                                <Banner tone="warn">
                                    {t('invalid', {
                                        invalid: symbols(cutPlan.invalid),
                                    })}
                                </Banner>
                            )}
                        </div>
                    ) : (
                        <>
                            <section
                                aria-label={t('totals.title')}
                                className="flex flex-col gap-2"
                            >
                                <header className="flex items-center gap-1">
                                    <h3 className="text-section">
                                        {t('totals.title')}
                                    </h3>
                                    <InfoTip
                                        content={t('config.help.totalsHelp')}
                                        label={t('config.help.info', {
                                            topic: t('totals.title'),
                                        })}
                                    />
                                </header>
                                <CutTotals plan={cutPlan.plan} />
                            </section>
                            <section
                                aria-label={t('parts.title')}
                                className="flex flex-col gap-2"
                            >
                                <header className="flex items-center gap-1">
                                    <h3 className="text-section">
                                        {t('parts.title')}
                                    </h3>
                                    <InfoTip
                                        content={t('config.help.partsHelp')}
                                        label={t('config.help.info', {
                                            topic: t('parts.title'),
                                        })}
                                    />
                                </header>
                                <PartsTable
                                    key={boxType}
                                    plan={cutPlan.plan}
                                    name={name}
                                />
                            </section>
                            {cutPlan.plan.volume.chambers.length > 0 && (
                                <section
                                    aria-label={t('volume.title')}
                                    className="flex flex-col gap-2"
                                >
                                    <header className="flex items-center gap-1">
                                        <h3 className="text-section">
                                            {t('volume.title')}
                                        </h3>
                                        <InfoTip
                                            content={t(
                                                'config.help.volumeHelp',
                                            )}
                                            label={t('config.help.info', {
                                                topic: t('volume.title'),
                                            })}
                                        />
                                    </header>
                                    <VolumeCheck volume={cutPlan.plan.volume} />
                                </section>
                            )}
                            <PlanWarnings plan={cutPlan.plan} />
                        </>
                    )}
                </div>
            </div>
            {cutPlan.status === 'ready' && (
                <Tabs<PlanView>
                    label={t('views.label')}
                    items={[
                        { id: 'drawings', label: t('drawings.title') },
                        ...(suggestion === undefined
                            ? []
                            : [
                                  {
                                      id: 'sheets' as const,
                                      label: t('sheets.title'),
                                  },
                              ]),
                    ]}
                    selected={
                        planView === 'sheets' && suggestion === undefined
                            ? 'drawings'
                            : planView
                    }
                    onChange={setPlanView}
                    variant="pill"
                >
                    {(id) => (
                        <div className="pt-4">
                            {id === 'drawings' && (
                                <CutDrawings plan={cutPlan.plan} />
                            )}
                            {id === 'sheets' && suggestion !== undefined && (
                                <SheetLayout
                                    layout={suggestion.layout}
                                    sheet={suggestion.sheet}
                                />
                            )}
                        </div>
                    )}
                </Tabs>
            )}
        </Panel>
    );
}
