import { useState } from 'react';
import {
    FieldError,
    Focusable,
    Input,
    Label,
    NumberField,
    Text,
    useLocale,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { PARAMETERS, withinRange } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { fromSi, toSi } from '@/lib/units/convert';
import { formatOptionsFor, formatQuantity } from '@/lib/units/format';
import { QUANTITIES, findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { cn } from '@/lib/utils';
import { Menu } from './menu';
import { StatusIndicator } from './status-indicator';
import type { FieldStatus } from './status-indicator';
import { HelpTip, useHoverless } from './help-tip';
import { Tooltip } from './tooltip';

type ParameterFieldProps = {
    parameter: ParameterKey;
    valueSi: number | undefined;
    // `undefined` quando o campo é esvaziado (o valor deixa de ser digitado).
    onChangeSi: (si: number | undefined) => void;
    unit: UnitId;
    onUnitChange?: (unit: UnitId) => void;
    status?: FieldStatus;
    statusMessage?: string;
    // Valor calculado dos outros parâmetros, mostrado apagado enquanto nada for digitado.
    derivedSi?: number;
    derivedLabel?: string;
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
    onUnitChange,
    status = 'none',
    statusMessage,
    derivedSi,
    derivedLabel,
    className,
}: ParameterFieldProps) {
    const { t } = useTranslation(['parameters', 'common']);
    const { locale } = useLocale();
    const [outOfRange, setOutOfRange] = useState(false);
    const hoverless = useHoverless();
    const definition = PARAMETERS[parameter];
    const units = QUANTITIES[definition.quantity].units;
    const symbol = findUnit(unit).symbol;
    const derived = valueSi === undefined && derivedSi !== undefined;
    const shownSi = valueSi ?? derivedSi;
    const displayed = shownSi === undefined ? Number.NaN : fromSi(shownSi, unit);

    // A ajuda abre também pelo campo numérico (hover ou foco); a descrição abaixo continua
    // `sr-only` para o leitor de tela, então o campo nunca muda de tamanho ao receber foco.
    const input = (
        <Input
            className={cn(
                'num w-full min-w-0 bg-transparent text-[15px] outline-none',
                derived ? 'text-muted' : 'text-foreground',
            )}
        />
    );

    return (
        <NumberField
            value={displayed}
            onChange={(value) => {
                if (!Number.isFinite(value)) {
                    setOutOfRange(false);
                    onChangeSi(undefined);
                    return;
                }

                // Sair do campo sem editar devolve o texto arredondado da tela: não é uma edição,
                // e aceitá-la trocaria o valor exato (ou o calculado) pelo arredondado.
                const step = 10 ** -findUnit(unit).decimals;

                if (
                    Number.isFinite(displayed) &&
                    Math.abs(value - displayed) <= step / 2
                ) {
                    setOutOfRange(false);
                    return;
                }

                const si = toSi(value, unit);

                // Valor impossível não entra no rascunho: o campo volta ao último valor válido e
                // mostra o motivo (FR-016).
                if (!withinRange(parameter, si)) {
                    setOutOfRange(true);
                    return;
                }

                setOutOfRange(false);
                onChangeSi(si);
            }}
            formatOptions={formatOptionsFor(unit)}
            isInvalid={outOfRange}
            validationBehavior="aria"
            className={cn(
                'group flex flex-col gap-1 rounded-md border bg-raised px-2.5 py-2 focus-within:border-accent',
                outOfRange ? 'border-status-error' : BORDER[status],
                className,
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-muted">
                    <HelpTip
                        content={t(`${parameter}.help`)}
                        label={t('common:help.of', {
                            parameter: definition.symbol,
                        })}
                    >
                        <span tabIndex={-1} className="cursor-help">
                            {definition.symbol}
                        </span>
                    </HelpTip>
                    <span className="sr-only">
                        {' '}
                        — {t(`${parameter}.label`)}
                    </span>
                </Label>
                {derived ? (
                    <span className="rounded-sm border border-border px-1 text-[10px] leading-4 text-muted">
                        {derivedLabel}
                    </span>
                ) : (
                    <StatusIndicator status={status} size="compact" />
                )}
            </div>
            <div className="flex items-baseline gap-1.5">
                {hoverless ? (
                    input
                ) : (
                    <Tooltip content={t(`${parameter}.help`)}>
                        <Focusable>{input}</Focusable>
                    </Tooltip>
                )}
                {units.length > 1 && onUnitChange !== undefined ? (
                    <Menu<UnitId>
                        label={t('common:units.change', {
                            parameter: definition.symbol,
                        })}
                        triggerLabel={t('common:units.changeFrom', {
                            unit: symbol,
                            parameter: definition.symbol,
                        })}
                        trigger={symbol}
                        items={units.map((item) => ({
                            id: item.id,
                            label: item.symbol,
                        }))}
                        selected={unit}
                        onAction={onUnitChange}
                        triggerClassName="shrink-0 text-xs text-accent-soft underline decoration-dotted underline-offset-2"
                    />
                ) : (
                    <span className="shrink-0 text-xs text-accent-soft">
                        {symbol}
                    </span>
                )}
            </div>
            <Text
                slot="description"
                className="sr-only"
            >
                {t(`${parameter}.help`)}
            </Text>
            <FieldError className="text-[11px] text-status-error">
                {t('common:validation.outOfRange', {
                    min: formatQuantity(definition.min, unit, locale),
                    max: formatQuantity(definition.max, unit, locale),
                    unit: symbol,
                })}
            </FieldError>
            {statusMessage !== undefined && (
                <p className="text-[11px] text-muted">{statusMessage}</p>
            )}
        </NumberField>
    );
}
