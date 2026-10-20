import type { ReactNode } from 'react';
import { Input, Label, NumberField, Text } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { fromSi, toSi } from '@/lib/units/convert';
import { formatOptionsFor } from '@/lib/units/format';
import { findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { cn } from '@/lib/utils';
import { StatusIndicator } from './status-indicator';
import type { FieldStatus } from './status-indicator';

type ParameterFieldProps = {
    parameter: ParameterKey;
    valueSi: number | undefined;
    onChangeSi: (si: number) => void;
    unit: UnitId;
    unitSlot?: ReactNode;
    status?: FieldStatus;
    statusMessage?: string;
    className?: string;
};

const BORDER: Record<FieldStatus, string> = {
    none: 'border-border',
    ok: 'border-border',
    unchecked: 'border-border',
    warn: 'border-status-warn',
    error: 'border-status-error',
};

export function ParameterField({
    parameter,
    valueSi,
    onChangeSi,
    unit,
    unitSlot,
    status = 'none',
    statusMessage,
    className,
}: ParameterFieldProps) {
    const { t } = useTranslation('parameters');
    const definition = PARAMETERS[parameter];
    const displayed = valueSi === undefined ? Number.NaN : fromSi(valueSi, unit);

    return (
        <NumberField
            value={displayed}
            onChange={(value) => {
                if (Number.isFinite(value)) {
                    onChangeSi(toSi(value, unit));
                }
            }}
            formatOptions={formatOptionsFor(unit)}
            className={cn(
                'flex flex-col gap-1 rounded-md border bg-raised px-2.5 py-2 focus-within:border-accent',
                BORDER[status],
                className,
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-muted">
                    {definition.symbol}
                    <span className="sr-only"> — {t(`${parameter}.label`)}</span>
                </Label>
                <StatusIndicator status={status} />
            </div>
            <div className="flex items-baseline gap-1.5">
                <Input className="num w-full min-w-0 bg-transparent text-[15px] text-foreground outline-none" />
                {unitSlot ?? (
                    <span className="shrink-0 text-xs text-accent-soft">
                        {findUnit(unit).symbol}
                    </span>
                )}
            </div>
            {statusMessage !== undefined && (
                <Text slot="description" className="text-[11px] text-muted">
                    {statusMessage}
                </Text>
            )}
        </NumberField>
    );
}
