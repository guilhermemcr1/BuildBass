import { useLocale } from 'react-aria-components';
import { formatQuantity } from '@/lib/units/format';
import { findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { cn } from '@/lib/utils';
import { StatusIndicator } from './status-indicator';
import type { FieldStatus } from './status-indicator';

type ValueTileProps = {
    label: string;
    valueSi?: number;
    unit: UnitId;
    // Texto no lugar do número (ex.: "< 10" quando o valor sai da faixa calculada).
    display?: string;
    status?: FieldStatus;
    statusLabel?: string;
    className?: string;
};

export function ValueTile({
    label,
    valueSi,
    unit,
    display,
    status = 'none',
    statusLabel,
    className,
}: ValueTileProps) {
    const { locale } = useLocale();

    return (
        <div className={cn('flex min-w-0 flex-col gap-0.5', className)}>
            <span className="truncate text-[11px] leading-4 text-muted">
                {label}
            </span>
            <span className="flex items-baseline gap-1 whitespace-nowrap">
                <span className="num text-base leading-6 font-semibold">
                    {display ?? formatQuantity(valueSi, unit, locale)}
                </span>
                <span className="text-xs text-muted">
                    {findUnit(unit).symbol}
                </span>
            </span>
            <StatusIndicator status={status} label={statusLabel} size="compact" />
        </div>
    );
}
