import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { ValueTile } from '@/components/ui/value-tile';
import { useActiveProject } from '@/hooks/use-active-project';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { planKeySymbol } from '@/lib/cut-plan-text';
import { displayName } from '@/lib/project/names';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { useWorkspace } from '@/stores/workspace';
import { Panel } from './panel';
import { PartsTable } from './parts-table';
import { PlanConfig } from './plan-config';
import { PlanWarnings } from './plan-warnings';
import { VolumeCheck } from './volume-check';

// Plano de corte do projeto ativo (specs/005): configuração, dimensões e lista de peças.
export function PlanPanel() {
    const { t } = useTranslation(['cutplan', 'project']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unit = defaultUnitFor('length', unitSystem);
    const cutPlan = useCutPlan();
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

    return (
        <Panel region="plan" title={t('title')}>
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
                </>
            )}
        </Panel>
    );
}
