import { useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { InfoTip } from '@/components/ui/help-tip';
import { ParameterField } from '@/components/ui/parameter-field';
import { SelectField } from '@/components/ui/select-field';
import { resolveCutPlan } from '@/cutplan';
import type { CutPlanProportion } from '@/cutplan';
import { useActiveProject } from '@/hooks/use-active-project';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { PARAMETERS } from '@/lib/parameters';
import {
    writeDimension,
    writeLockVolume,
    writeProportion,
} from '@/lib/project/fields';
import { formatQuantity } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { BoxMeasureToggle, useBoxMeasure } from './box-measure';

const PROPORTION_IDS: CutPlanProportion[] = [
    'golden',
    'louden',
    'equalSteps',
    'cube',
    'custom',
];

const AXES = [
    ['dim_h_m', 'h'],
    ['dim_w_m', 'w'],
    ['dim_d_m', 'd'],
] as const;

// Formato da caixa: uma proporção pronta ou as três medidas internas, em mm, editáveis. Com
// "Manter o volume", editar uma medida ajusta as outras duas e o Vb não muda; sem ela, as outras
// ficam e o Vb acompanha a caixa. Nos dois casos a proporção passa para "Própria".
export function BoxShape() {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const fieldUnits = useActiveProject((state) => state.data.fieldUnits);
    const setFieldUnit = useActiveProject((state) => state.setFieldUnit);
    const config = useActiveProject((state) => state.data.cutPlan);
    const apply = useActiveProject((state) => state.apply);
    const cutPlan = useCutPlan();
    const resolved = resolveCutPlan(config);
    const ready = cutPlan.status === 'ready';
    const lockVolume = config?.lockVolume !== false;
    const internal = ready ? cutPlan.plan.dimensions.internal : undefined;
    const title = t('config.groups.shape');
    const lengthUnit = defaultUnitFor('length', unitSystem);
    const externalUnit = fieldUnits.dim_h_m ?? lengthUnit;

    const externalSize = ready ? cutPlan.plan.dimensions.external : undefined;
    const [measure, setMeasure] = useBoxMeasure('internal');
    const outside = measure === 'external';
    const wall = 2 * resolved.thickness_m;
    const [tooSmall, setTooSmall] = useState(false);

    const sizeText = (
        size: { w_m: number; h_m: number; d_m: number } | undefined,
    ) =>
        size === undefined
            ? '—'
            : [size.w_m, size.h_m, size.d_m]
                  .map((si) => formatQuantity(si, externalUnit, locale))
                  .join(' × ');

    return (
        <section
            aria-label={title}
            className="flex flex-col gap-2.5 rounded-lg border border-border bg-raised/40 p-3"
        >
            <header className="flex items-center gap-1">
                <h3 className="text-section">{title}</h3>
                <InfoTip
                    content={t('config.help.shape')}
                    label={t('config.help.info', { topic: title })}
                />
            </header>
            <SelectField<CutPlanProportion>
                label={t('config.proportion')}
                hideLabel
                selected={resolved.proportion}
                onChange={(proportion) =>
                    apply((data) => writeProportion(data, proportion))
                }
                options={PROPORTION_IDS.map((id) => ({
                    id,
                    label: t(`proportions.${id}`),
                }))}
            />
            <BoxMeasureToggle measure={measure} onChange={setMeasure} />
            <div className="grid grid-cols-3 gap-2">
                {AXES.map(([key, axis]) => {
                    const unit: UnitId =
                        fieldUnits[key] ??
                        defaultUnitFor(PARAMETERS[key].quantity, unitSystem);
                    const shown = outside ? externalSize : internal;

                    return (
                        <ParameterField
                            key={key}
                            parameter={key}
                            layout="stacked"
                            labelContext={
                                outside ? t('config.externalField') : undefined
                            }
                            valueSi={shown?.[`${axis}_m`]}
                            disabled={internal === undefined}
                            unit={unit}
                            onUnitChange={(next) => setFieldUnit(key, next)}
                            onChangeSi={(si) => {
                                if (
                                    internal === undefined ||
                                    si === undefined
                                ) {
                                    return;
                                }

                                // Por fora: tira as duas chapas para chegar à medida interna.
                                const inner = outside ? si - wall : si;

                                if (inner <= 0) {
                                    setTooSmall(true);
                                    return;
                                }

                                setTooSmall(false);
                                apply((data) =>
                                    writeDimension(data, internal, axis, inner),
                                );
                            }}
                        />
                    );
                })}
            </div>
            {tooSmall && outside && (
                <p role="alert" className="-mt-1 text-[11px] text-status-warn">
                    {t('config.tooSmall', {
                        min: `${formatQuantity(wall, externalUnit, locale)} ${findUnit(externalUnit).symbol}`,
                    })}
                </p>
            )}
            <Checkbox
                selected={lockVolume}
                onChange={(lock) =>
                    apply((data) => writeLockVolume(data, lock))
                }
                className="text-xs"
            >
                {t('config.lockVolume')}
            </Checkbox>
            <p className="-mt-1 text-[11px] text-muted">
                {t(lockVolume ? 'config.lockVolumeOn' : 'config.lockVolumeOff')}
            </p>
            {internal === undefined ? (
                <p className="text-[11px] text-muted">
                    {t('config.needsVolume')}
                </p>
            ) : (
                <p className="flex justify-between gap-3 text-xs">
                    <span className="text-muted">
                        {t(
                            outside
                                ? 'config.internalWithoutWood'
                                : 'config.externalWithWood',
                        )}{' '}
                        ({t('config.axes')})
                    </span>
                    <span className="num">
                        {sizeText(outside ? internal : externalSize)}{' '}
                        {findUnit(externalUnit).symbol}
                    </span>
                </p>
            )}
        </section>
    );
}
