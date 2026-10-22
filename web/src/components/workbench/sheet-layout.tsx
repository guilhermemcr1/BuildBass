import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import type {
    Placement,
    ResolvedSheet,
    SheetLayout as Layout,
} from '@/cutplan';
import { pieceName } from '@/lib/cut-plan-text';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// O desenho usa milímetros como unidade de tela; a unidade exibida é a do usuário.
const MM = 1000;

type SheetLayoutProps = {
    layout: Layout;
    sheet: ResolvedSheet;
};

// Sugestão de corte da chapa do usuário (specs/008): uma figura por chapa usada, com cada peça
// no lugar em que deve ser cortada, o aproveitamento e a sobra.
export function SheetLayout({ layout, sheet }: SheetLayoutProps) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const percent = new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 1,
    });
    const length = (si: number) =>
        formatWithUnit(si, defaultUnitFor('length', unitSystem), locale);
    const area = (si: number) =>
        formatWithUnit(si, defaultUnitFor('area', unitSystem), locale);
    const label = (placement: Pick<Placement, 'role' | 'unit'>) =>
        `${pieceName(placement.role, t)} ${placement.unit}`;
    const list = new Intl.ListFormat(locale, {
        style: 'long',
        type: 'conjunction',
    });
    const fontSize = Math.max(sheet.w_m, sheet.h_m) * MM * 0.022;

    return (
        <div className="flex flex-col gap-3">
            {layout.oversize.length > 0 && (
                <Banner tone="warn">
                    {t('sheets.oversizeWarning', {
                        pieces: list.format(layout.oversize.map(label)),
                    })}
                </Banner>
            )}
            {layout.sheetCount === 0 ? (
                <p className="text-sm text-muted">{t('sheets.empty')}</p>
            ) : (
                <>
                    <p className="num text-sm">
                        {t('sheets.summary', {
                            count: layout.sheetCount,
                            utilization: percent.format(layout.utilization),
                            waste: area(layout.waste_m2),
                        })}
                    </p>
                    {layout.sheets.map((entry, index) => (
                        <figure
                            key={index}
                            className="flex flex-col gap-1.5"
                            data-sheet={index + 1}
                        >
                            <figcaption className="text-xs font-semibold text-muted">
                                {t('sheets.sheetOf', {
                                    n: index + 1,
                                    total: layout.sheetCount,
                                })}
                                {' · '}
                                <span className="num font-normal">
                                    {percent.format(entry.utilization)}
                                </span>
                            </figcaption>
                            <svg
                                role="img"
                                aria-label={t('sheets.drawing', {
                                    n: index + 1,
                                    count: entry.placements.length,
                                    utilization: percent.format(
                                        entry.utilization,
                                    ),
                                })}
                                viewBox={`${-fontSize} ${-fontSize} ${sheet.w_m * MM + 2 * fontSize} ${sheet.h_m * MM + 2 * fontSize}`}
                                className="h-auto w-full rounded-sm"
                            >
                                <rect
                                    x={0}
                                    y={0}
                                    width={sheet.w_m * MM}
                                    height={sheet.h_m * MM}
                                    className="fill-surface stroke-muted"
                                    strokeWidth={fontSize * 0.1}
                                />
                                {entry.placements.map((placement) => {
                                    const w = placement.w_m * MM;
                                    const h = placement.h_m * MM;
                                    const x = placement.x_m * MM;
                                    // O eixo y do SVG cresce para baixo; a chapa nasce embaixo.
                                    const y =
                                        (sheet.h_m -
                                            placement.y_m -
                                            placement.h_m) *
                                        MM;
                                    const text = placement.rotated
                                        ? `${label(placement)} (${t('sheets.rotatedMark')})`
                                        : label(placement);
                                    const fits =
                                        w > text.length * fontSize * 0.55 &&
                                        h > fontSize * 1.6;

                                    return (
                                        <g
                                            key={`${placement.role}-${placement.unit}`}
                                            data-piece={`${placement.role}-${placement.unit}`}
                                            data-rotated={placement.rotated}
                                        >
                                            <rect
                                                x={x}
                                                y={y}
                                                width={w}
                                                height={h}
                                                className={
                                                    placement.rotated
                                                        ? 'fill-accent-soft stroke-foreground'
                                                        : 'fill-raised stroke-foreground'
                                                }
                                                strokeWidth={fontSize * 0.08}
                                            />
                                            {fits && (
                                                <text
                                                    x={x + w / 2}
                                                    y={y + h / 2}
                                                    fontSize={fontSize}
                                                    textAnchor="middle"
                                                    dominantBaseline="central"
                                                    className="fill-foreground"
                                                >
                                                    {text}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                            </svg>
                            <ul className="sr-only">
                                {entry.placements.map((placement) => (
                                    <li
                                        key={`${placement.role}-${placement.unit}`}
                                    >
                                        {label(placement)}
                                        {': '}
                                        {length(placement.w_m)}
                                        {' × '}
                                        {length(placement.h_m)}
                                        {placement.rotated
                                            ? `, ${t('sheets.rotatedMark')}`
                                            : ''}
                                    </li>
                                ))}
                            </ul>
                        </figure>
                    ))}
                </>
            )}
        </div>
    );
}
