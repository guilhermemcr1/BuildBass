import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SelectField } from '@/components/ui/select-field';
import { resolveCutPlan } from '@/cutplan';
import type { CutPlanProportion } from '@/cutplan';
import { useActiveProject } from '@/hooks/use-active-project';
import { writeProportion } from '@/lib/project/fields';
import { useParameterField } from './use-parameter-field';

const PROPORTION_IDS: CutPlanProportion[] = [
    'golden',
    'louden',
    'equalSteps',
    'cube',
    'custom',
];

// Espessura, proporção, reforços e diâmetro do recorte: o que o plano precisa além do projeto.
export function PlanConfig() {
    const { t } = useTranslation('cutplan');
    const config = useActiveProject((state) => state.data.cutPlan);
    const apply = useActiveProject((state) => state.apply);
    const resolved = resolveCutPlan(config);
    const thickness = useParameterField('thickness_m');
    const braces = useParameterField('braces_m3');
    const cutout = useParameterField('cutout_m');
    const ratioH = useParameterField('ratio_h');
    const ratioW = useParameterField('ratio_w');
    const ratioD = useParameterField('ratio_d');

    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-muted">
                {t('config.title')}
            </h3>
            <ParameterField {...thickness} />
            <SelectField<CutPlanProportion>
                label={t('config.proportion')}
                selected={resolved.proportion}
                onChange={(proportion) =>
                    apply((data) => writeProportion(data, proportion))
                }
                options={PROPORTION_IDS.map((id) => ({
                    id,
                    label: t(`proportions.${id}`),
                }))}
            />
            {resolved.proportion === 'custom' ? (
                <div className="grid grid-cols-3 gap-2">
                    <ParameterField {...ratioH} />
                    <ParameterField {...ratioW} />
                    <ParameterField {...ratioD} />
                </div>
            ) : (
                <p className="num text-xs text-muted">
                    {t('config.ratioLine', {
                        h: resolved.ratio.h.toFixed(2),
                        w: resolved.ratio.w.toFixed(2),
                        d: resolved.ratio.d.toFixed(2),
                    })}
                </p>
            )}
            <p className="text-[11px] text-muted">{t('config.hint')}</p>
            <ParameterField {...braces} />
            <ParameterField {...cutout} />
        </div>
    );
}
