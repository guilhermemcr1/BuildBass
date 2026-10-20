import { useLocale } from 'react-aria-components';
import { formatQuantity } from '@/lib/units/format';
import { findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { cn } from '@/lib/utils';

type ValueTileProps = {
    label: string;
    valueSi?: number;
    unit: UnitId;
    // Texto no lugar do número (ex.: "< 10" quando o valor sai da faixa calculada).
    display?: string;
    className?: string;
};

export function ValueTile({
    label,
    valueSi,
    unit,
    display,
    className,
}: ValueTileProps) {
    const { locale } = useLocale();

    return (
        <div
            className={cn(
                'flex flex-col gap-1 rounded-md border border-border bg-raised px-3 py-2.5',
                className,
            )}
        >
            <span className="text-xs text-muted">{label}</span>
            <span className="flex items-baseline gap-1">
                <span className="num text-lg font-semibold">
                    {display ?? formatQuantity(valueSi, unit, locale)}
                </span>
                <span className="text-xs text-muted">
                    {findUnit(unit).symbol}
                </span>
            </span>
        </div>
    );
}
