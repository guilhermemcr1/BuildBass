import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { Plan } from '@/cutplan';
import { cutoutSummary, pieceName, piecePosition } from '@/lib/cut-plan-text';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// Lista de corte: a fonte da verdade do plano (os desenhos só repetem o que está aqui, FR-012).
export function PartsTable({ plan, name }: { plan: Plan; name: string }) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unit = defaultUnitFor('length', unitSystem);
    const length = (meters: number) => formatWithUnit(meters, unit, locale);
    const text = { t, length };
    const divider = plan.pieces.some((piece) => piece.role === 'divider');

    const headers = [
        'piece',
        'position',
        'quantity',
        'length',
        'width',
        'thickness',
        'cutouts',
    ] as const;

    return (
        <div className="flex flex-col gap-2">
            {/* Em telas estreitas a tabela rola na horizontal: a área recebe foco para rolar pelo
                teclado (como a tabela de resultados). */}
            <div
                role="region"
                aria-label={t('parts.caption', { name })}
                tabIndex={0}
                className="overflow-x-auto rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-solid"
            >
                <table className="w-full border-collapse text-left text-sm">
                    <caption className="pb-1.5 text-left text-xs font-semibold text-muted">
                        {t('parts.caption', { name })}
                    </caption>
                    <thead>
                        <tr className="border-b border-border text-xs text-muted">
                            {headers.map((header) => (
                                <th
                                    key={header}
                                    scope="col"
                                    className="px-2 py-1.5 font-semibold whitespace-nowrap"
                                >
                                    {t(`parts.columns.${header}`)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {plan.pieces.map((piece) => {
                            const cutouts = cutoutSummary(piece.cutouts, text);

                            return (
                                <tr
                                    key={piece.role}
                                    className="border-b border-border align-top last:border-b-0"
                                >
                                    <th
                                        scope="row"
                                        className="px-2 py-1.5 font-semibold whitespace-nowrap"
                                    >
                                        {pieceName(piece.role, t)}
                                    </th>
                                    <td className="px-2 py-1.5">
                                        {piecePosition(piece.role, t)}
                                    </td>
                                    <td className="px-2 py-1.5 num">
                                        {piece.quantity}
                                    </td>
                                    <td className="px-2 py-1.5 num whitespace-nowrap">
                                        {length(Math.max(piece.w_m, piece.h_m))}
                                    </td>
                                    <td className="px-2 py-1.5 num whitespace-nowrap">
                                        {length(Math.min(piece.w_m, piece.h_m))}
                                    </td>
                                    <td className="px-2 py-1.5 num whitespace-nowrap">
                                        {length(piece.thickness_m)}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        {cutouts.length === 0 ? (
                                            t('parts.none')
                                        ) : (
                                            <ul className="flex flex-col gap-0.5">
                                                {cutouts.map((line) => (
                                                    <li key={line}>{line}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="text-[11px] text-muted">
                {t('parts.convention')}
                {divider && ` ${t('parts.conventionDivider')}`}
            </p>
        </div>
    );
}
