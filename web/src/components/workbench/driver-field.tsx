import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import type { DerivedDriver, DriverKey } from '@/engine';
import { useParameterField } from './use-parameter-field';

// Status de consistência do motor e valor calculado de cada campo.
export function DriverField({
    parameter,
    derived,
}: {
    parameter: DriverKey;
    derived: DerivedDriver;
}) {
    const { t } = useTranslation('engine');
    const { locale } = useLocale();
    const field = useParameterField(parameter);
    const { status, relation, deviation } = derived.consistency[parameter];
    const percent = new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 1,
    });

    return (
        <ParameterField
            {...field}
            status={status === 'derived' ? 'none' : status}
            statusMessage={
                relation !== undefined &&
                deviation !== undefined &&
                status !== 'ok'
                    ? t(`status.${relation}`, {
                          deviation: percent.format(deviation),
                      })
                    : undefined
            }
            derivedSi={
                status === 'derived'
                    ? derived.values[parameter].value
                    : undefined
            }
            derivedLabel={t('status.derived')}
        />
    );
}
