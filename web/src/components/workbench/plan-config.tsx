import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { ShowMore } from '@/components/ui/show-more';
import { ParameterField } from '@/components/ui/parameter-field';
import { SelectField } from '@/components/ui/select-field';
import { resolveCutPlan } from '@/cutplan';
import type { CutPlanProportion } from '@/cutplan';
import { useActiveProject } from '@/hooks/use-active-project';
import { writeProportion, writeSheetRotate } from '@/lib/project/fields';
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
    const { locale } = useLocale();
    const ratio = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const config = useActiveProject((state) => state.data.cutPlan);
    const apply = useActiveProject((state) => state.apply);
    const resolved = resolveCutPlan(config);
    const thickness = useParameterField('thickness_m');
    const braces = useParameterField('braces_m3');
    const cutout = useParameterField('cutout_m');
    const ratioH = useParameterField('ratio_h');
    const ratioW = useParameterField('ratio_w');
    const ratioD = useParameterField('ratio_d');
    const sheetW = useParameterField('sheet_w_m');
    const sheetH = useParameterField('sheet_h_m');
    const kerf = useParameterField('kerf_m');
    const sheetStarted = config?.sheet !== undefined;
    // Avançados com valor próprio (reforços, perda de serra diferente da padrão ou rotação
    // desligada): o botão recolhido avisa que há algo dentro.
    const advancedFilled = [
        config?.braces_m3 !== undefined,
        config?.sheet?.kerf_m !== undefined,
        config?.sheet?.rotate === false,
    ].filter(Boolean).length;

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
                        h: ratio.format(resolved.ratio.h),
                        w: ratio.format(resolved.ratio.w),
                        d: ratio.format(resolved.ratio.d),
                    })}
                </p>
            )}
            <p className="text-[11px] text-muted">{t('config.hint')}</p>
            <ParameterField {...cutout} />
            <fieldset className="flex flex-col gap-3">
                <legend className="mb-1.5 text-xs font-semibold text-muted">
                    {t('sheet.title')}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                    <ParameterField {...sheetW} />
                    <ParameterField {...sheetH} />
                </div>
                <p className="text-[11px] text-muted">{t('sheet.hint')}</p>
            </fieldset>
            <ShowMore id="planAdvanced" filled={advancedFilled}>
                <ParameterField {...braces} />
                <ParameterField {...kerf} />
                <Checkbox
                    selected={
                        resolved.sheet?.rotate ?? config?.sheet?.rotate ?? true
                    }
                    disabled={!sheetStarted}
                    onChange={(rotate) =>
                        apply((data) => writeSheetRotate(data, rotate))
                    }
                >
                    {t('sheet.rotate')}
                </Checkbox>
            </ShowMore>
        </div>
    );
}
