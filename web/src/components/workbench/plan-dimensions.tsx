import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { Plan } from '@/cutplan';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// Dimensões em tabela (folha impressa); na tela elas aparecem como tiles no PlanPanel.
export function PlanDimensions({ plan }: { plan: Plan }) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unit = defaultUnitFor('length', unitSystem);
    const format = (si: number) => formatWithUnit(si, unit, locale);
    const { internal, external, chambers } = plan.dimensions;

    return (
        <table className="w-full border-collapse text-left text-sm">
            <caption className="pb-1.5 text-left text-xs font-semibold">
                {t('dimensions.title')}
            </caption>
            <thead>
                <tr className="border-b border-border text-xs">
                    <td />
                    {(['width', 'height', 'depth'] as const).map((axis) => (
                        <th
                            key={axis}
                            scope="col"
                            className="px-2 py-1 font-semibold"
                        >
                            {t(`dimensions.${axis}`)}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {(
                    [
                        ['internal', internal],
                        ['external', external],
                    ] as const
                ).map(([kind, size]) => (
                    <tr key={kind} className="border-b border-border">
                        <th scope="row" className="px-2 py-1 font-semibold">
                            {t(`dimensions.${kind}`)}
                        </th>
                        <td className="px-2 py-1 num">{format(size.w_m)}</td>
                        <td className="px-2 py-1 num">{format(size.h_m)}</td>
                        <td className="px-2 py-1 num">{format(size.d_m)}</td>
                    </tr>
                ))}
                {chambers !== undefined && (
                    <>
                        <tr className="border-b border-border">
                            <th scope="row" className="px-2 py-1 font-semibold">
                                {t('dimensions.rearDepth')}
                            </th>
                            <td colSpan={3} className="px-2 py-1 num">
                                {format(chambers.rear_d_m)}
                            </td>
                        </tr>
                        <tr>
                            <th scope="row" className="px-2 py-1 font-semibold">
                                {t('dimensions.frontDepth')}
                            </th>
                            <td colSpan={3} className="px-2 py-1 num">
                                {format(chambers.front_d_m)}
                            </td>
                        </tr>
                    </>
                )}
            </tbody>
        </table>
    );
}
