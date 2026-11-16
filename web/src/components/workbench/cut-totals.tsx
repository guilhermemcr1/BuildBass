import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { cutTotals } from '@/cutplan';
import type { Basis, Plan } from '@/cutplan';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// Corte total sem e com o desconto do MDF: a espessura acrescentada às medidas aparece
// na linha de diferença.
export function CutTotals({ plan }: { plan: Plan }) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const totals = cutTotals(plan);
    const length = (si: number) =>
        formatWithUnit(si, defaultUnitFor('length', unitSystem), locale);
    const area = (si: number) =>
        formatWithUnit(si, defaultUnitFor('area', unitSystem), locale);
    const rows: [string, Basis, boolean][] = [
        [t('totals.gross'), totals.gross, false],
        [t('totals.net'), totals.net, false],
        [t('totals.difference'), totals.difference, true],
    ];

    return (
        <div className="flex flex-col gap-1.5">
            <table
                aria-label={t('totals.title')}
                className="w-full border-collapse text-sm"
            >
                <thead>
                    <tr className="text-left text-xs text-muted">
                        <th scope="col" className="py-1 pr-2 font-normal">
                            <span className="sr-only">{t('totals.title')}</span>
                        </th>
                        <th
                            scope="col"
                            className="px-2 py-1 text-right font-normal"
                        >
                            {t('totals.pieces')}
                        </th>
                        <th
                            scope="col"
                            className="px-2 py-1 text-right font-normal"
                        >
                            {t('totals.area')}
                        </th>
                        <th
                            scope="col"
                            className="py-1 pl-2 text-right font-normal"
                        >
                            {t('totals.cutLength')}
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(([label, basis, muted]) => (
                        <tr key={label} className="border-t border-border">
                            <th
                                scope="row"
                                className={`py-1.5 pr-2 text-left font-normal ${muted ? 'text-muted' : ''}`}
                            >
                                {label}
                            </th>
                            <td className="px-2 py-1.5 text-right num">
                                {basis.pieces}
                            </td>
                            <td className="px-2 py-1.5 text-right num">
                                {area(basis.area_m2)}
                            </td>
                            <td className="py-1.5 pl-2 text-right num">
                                {length(basis.cutLength_m)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="text-[11px] text-muted">{t('totals.hint')}</p>
        </div>
    );
}
