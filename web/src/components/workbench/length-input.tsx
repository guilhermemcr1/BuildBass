import { useState } from 'react';
import {
    FieldError,
    Input,
    Label,
    NumberField,
    useLocale,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { fromSi, toSi } from '@/lib/units/convert';
import { formatOptionsFor, formatQuantity } from '@/lib/units/format';
import type { UnitId } from '@/lib/units/quantities';

type LengthInputProps = {
    label: string;
    valueSi: number | undefined;
    onChange: (si: number | undefined) => void;
    range: { min: number; max: number };
    unit: UnitId;
};

// Medida física que não é parâmetro da bancada (diâmetro nominal, profundidade): digita-se na
// unidade exibida, o estado fica em SI e valor fora da faixa não entra no estado.
export function LengthInput({
    label,
    valueSi,
    onChange,
    range,
    unit,
}: LengthInputProps) {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const [outOfRange, setOutOfRange] = useState(false);
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
            className="group flex flex-col gap-1 rounded-md border border-border bg-raised px-2.5 py-2 focus-within:border-accent"
        >
            <Label className="text-xs font-semibold text-muted">{label}</Label>
            <Input className="w-full min-w-0 bg-transparent num text-[15px] outline-none" />
            <FieldError className="text-[11px] text-status-error">
                {t('saved.errors.range', {
                    min: formatQuantity(range.min, unit, locale),
                    max: formatQuantity(range.max, unit, locale),
                })}
            </FieldError>
        </NumberField>
    );
}
