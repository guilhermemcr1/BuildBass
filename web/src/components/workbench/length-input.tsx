import { useState } from 'react';
import {
    FieldError,
    Input,
    Label,
    NumberField,
    useLocale,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNumberEntry } from '@/hooks/use-number-entry';
import { fromSi, toSi } from '@/lib/units/convert';
import { formatOptionsFor, formatQuantity } from '@/lib/units/format';
import { findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { FIELD_BOX, FIELD_INPUT, UnitAddon } from '@/components/ui/field-box';
import { cn } from '@/lib/utils';

type LengthInputProps = {
    label: string;
    valueSi: number | undefined;
    onChange: (si: number | undefined) => void;
    range: { min: number; max: number };
    unit: UnitId;
    // Valor típico (SI), mostrado como placeholder enquanto o campo está vazio.
    example?: number;
};

// Medida física que não é parâmetro da bancada (diâmetro nominal, profundidade): digita-se na
// unidade exibida, o estado fica em SI e valor fora da faixa não entra no estado.
export function LengthInput({
    label,
    valueSi,
    onChange,
    range,
    unit,
    example,
}: LengthInputProps) {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const [outOfRange, setOutOfRange] = useState(false);
    const entryRef = useNumberEntry(locale);
    const displayed =
        valueSi === undefined ? Number.NaN : fromSi(valueSi, unit);

    return (
        <NumberField
            value={displayed}
            formatOptions={formatOptionsFor(unit)}
            isInvalid={outOfRange}
            validationBehavior="aria"
            onChange={(value) => {
                if (!Number.isFinite(value)) {
                    setOutOfRange(false);
                    onChange(undefined);

                    return;
                }

                const si = toSi(value, unit);

                if (si < range.min || si > range.max) {
                    setOutOfRange(true);

                    return;
                }

                setOutOfRange(false);
                onChange(si);
            }}
            className="group flex flex-col gap-1"
        >
            <Label className="text-xs font-semibold text-muted">{label}</Label>
            <div className={cn(FIELD_BOX, outOfRange && 'border-status-error')}>
                <Input
                    ref={entryRef}
                    placeholder={
                        example === undefined
                            ? undefined
                            : t('placeholder.example', {
                                  ns: 'common',
                                  value: formatQuantity(example, unit, locale),
                              })
                    }
                    className={cn(FIELD_INPUT, 'num')}
                />
                <UnitAddon symbol={findUnit(unit).symbol} />
            </div>
            <FieldError className="text-[11px] text-status-error">
                {t('saved.errors.range', {
                    min: formatQuantity(range.min, unit, locale),
                    max: formatQuantity(range.max, unit, locale),
                })}
            </FieldError>
        </NumberField>
    );
}
