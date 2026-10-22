import { Download, Printer } from 'lucide-react';
import { Suspense, lazy, useId, useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { ValueTile } from '@/components/ui/value-tile';
import { useActiveProject } from '@/hooks/use-active-project';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { useSheetLayout } from '@/hooks/use-sheet-layout';
import { csvFormatFor, downloadCutPlanCsv } from '@/lib/cut-plan-export';
import { planKeySymbol } from '@/lib/cut-plan-text';
import { displayName } from '@/lib/project/names';
import { defaultUnitFor } from '@/lib/units/quantities';
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

const Box3dView = lazy(() => import('./box-3d-view'));

type PlanView = 'drawings' | 'view3d' | 'sheets';

// Plano de corte do projeto ativo (specs/005): configuração, dimensões e lista de peças.
export function PlanPanel() {
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
                onPress={() => window.print()}
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

    return (
        <Panel region="plan" title={t('title')} actions={actions}>
            <PlanConfig />
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
                        aria-label={t('dimensions.title')}
                        className="flex flex-col gap-2"
                    >
                        <h3 className="text-xs font-semibold text-muted">
                            {t('dimensions.title')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {(['internal', 'external'] as const).map((kind) => (
                                <div key={kind} className="flex flex-col gap-2">
                                    <ValueTile
                                        label={`${t(`dimensions.${kind}`)} · ${t('dimensions.width')}`}
                                        valueSi={
                                            cutPlan.plan.dimensions[kind].w_m
                                        }
                                        unit={unit}
                                    />
                                    <ValueTile
                                        label={`${t(`dimensions.${kind}`)} · ${t('dimensions.height')}`}
                                        valueSi={
                                            cutPlan.plan.dimensions[kind].h_m
                                        }
                                        unit={unit}
                                    />
                                    <ValueTile
                                        label={`${t(`dimensions.${kind}`)} · ${t('dimensions.depth')}`}
                                        valueSi={
                                            cutPlan.plan.dimensions[kind].d_m
                                        }
                                        unit={unit}
                                    />
                                </div>
                            ))}
                        </div>
                        {cutPlan.plan.dimensions.chambers !== undefined && (
                            <div className="grid grid-cols-2 gap-2">
                                <ValueTile
                                    label={t('dimensions.rearDepth')}
                                    valueSi={
                                        cutPlan.plan.dimensions.chambers
                                            .rear_d_m
                                    }
                                    unit={unit}
                                />
                                <ValueTile
                                    label={t('dimensions.frontDepth')}
                                    valueSi={
                                        cutPlan.plan.dimensions.chambers
                                            .front_d_m
                                    }
                                    unit={unit}
                                />
                            </div>
                        )}
                    </section>
                    <section
                        aria-label={t('totals.title')}
                        className="flex flex-col gap-2"
                    >
                        <h3 className="text-xs font-semibold text-muted">
                            {t('totals.title')}
                        </h3>
                        <CutTotals plan={cutPlan.plan} />
                    </section>
                    <section
                        aria-label={t('parts.title')}
                        className="flex flex-col gap-2"
                    >
                        <h3 className="text-xs font-semibold text-muted">
                            {t('parts.title')}
                        </h3>
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
                            <h3 className="text-xs font-semibold text-muted">
                                {t('volume.title')}
                            </h3>
                            <VolumeCheck volume={cutPlan.plan.volume} />
                        </section>
                    )}
                    <PlanWarnings plan={cutPlan.plan} />
                    <Tabs<PlanView>
                        label={t('views.label')}
                        items={[
                            { id: 'drawings', label: t('drawings.title') },
                            { id: 'view3d', label: t('view3d.title') },
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
                    >
                        {(id) => (
                            <div className="pt-3">
                                {id === 'drawings' && (
                                    <CutDrawings plan={cutPlan.plan} />
                                )}
                                {id === 'view3d' && (
                                    <Suspense fallback={null}>
                                        <Box3dView plan={cutPlan.plan} />
                                    </Suspense>
                                )}
                                {id === 'sheets' &&
                                    suggestion !== undefined && (
                                        <SheetLayout
                                            layout={suggestion.layout}
                                            sheet={suggestion.sheet}
                                        />
                                    )}
                            </div>
                        )}
                    </Tabs>
                </>
            )}
        </Panel>
    );
}
