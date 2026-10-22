import { useId, useState } from 'react';
import {
    Label,
    NumberField,
    Input,
    FieldError,
    useLocale,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useNumberEntry } from '@/hooks/use-number-entry';
import { Button } from '@/components/ui/button';
import { FIELD_BOX, FIELD_INPUT, UnitAddon } from '@/components/ui/field-box';
import { ParameterField } from '@/components/ui/parameter-field';
import { TextInput } from '@/components/ui/text-field';
import type { SubmitFailure } from '@/hooks/use-submit-driver';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import {
    OPTIONAL_KEYS,
    REQUIRED_KEYS,
    TEXT_LIMITS,
    rangeOf,
} from '@/lib/submission/schema';
import type {
    NumericKey,
    SubmissionErrorCode,
    SubmissionErrors,
    SubmissionFieldId,
    SubmissionForm,
} from '@/lib/submission/schema';
import { fromSi, toSi } from '@/lib/units/convert';
import { formatOptionsFor, formatQuantity } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { DriverTypeSelect } from './driver-type-select';

type SubmitDriverFormProps = {
    form: SubmissionForm;
    onChange: (form: SubmissionForm) => void;
    trap: string;
    onTrapChange: (value: string) => void;
    errors: SubmissionErrors;
    failure: SubmitFailure | undefined;
    sending: boolean;
    offline: boolean;
    onSubmit: () => void;
    onCancel: () => void;
    onRetry: () => void;
};

// Diâmetro nominal: não é um parâmetro da bancada, então não passa por ParameterField. Mesmo
// comportamento: digita-se na unidade exibida, o estado fica em SI.
function DiameterField({
    valueSi,
    onChange,
    error,
    unit,
}: {
    valueSi: number | undefined;
    onChange: (si: number | undefined) => void;
    error: string | undefined;
    unit: UnitId;
}) {
    const { t } = useTranslation('submission');
    const { locale } = useLocale();
    const [outOfRange, setOutOfRange] = useState(false);
    const entryRef = useNumberEntry(locale);
    const { min, max } = rangeOf('nominal_diameter_m');
    const displayed =
        valueSi === undefined ? Number.NaN : fromSi(valueSi, unit);

    return (
        <NumberField
            value={displayed}
            formatOptions={formatOptionsFor(unit)}
            isInvalid={outOfRange || error !== undefined}
            validationBehavior="aria"
            onChange={(value) => {
                if (!Number.isFinite(value)) {
                    setOutOfRange(false);
                    onChange(undefined);
                    return;
                }

                const si = toSi(value, unit);

                if (si < min || si > max) {
                    setOutOfRange(true);
                    return;
                }

                setOutOfRange(false);
                onChange(si);
            }}
            className="group flex flex-col gap-1"
        >
            <Label className="text-xs font-semibold text-muted">
                {t('fields.diameter')}
            </Label>
            <div
                className={cn(
                    FIELD_BOX,
                    (outOfRange || error !== undefined) &&
                        'border-status-error',
                )}
            >
                <Input ref={entryRef} className={cn(FIELD_INPUT, 'num')} />
                <UnitAddon symbol={findUnit(unit).symbol} />
            </div>
            <FieldError className="text-[11px] text-status-error">
                {`${t('errors.range')} (${formatQuantity(min, unit, locale)} – ${formatQuantity(max, unit, locale)})`}
            </FieldError>
        </NumberField>
    );
}

export function SubmitDriverForm({
    form,
    onChange,
    trap,
    onTrapChange,
    errors,
    failure,
    sending,
    offline,
    onSubmit,
    onCancel,
    onRetry,
}: SubmitDriverFormProps) {
    const { t } = useTranslation(['submission', 'parameters']);
    const unitSystem = usePreferences((state) => state.unitSystem);
    const [units, setUnits] = useState<Partial<Record<NumericKey, UnitId>>>({});
    const errorCount = Object.keys(errors).length;
    const offlineId = useId();

    const message = (field: SubmissionFieldId): string | undefined => {
        const code: SubmissionErrorCode | undefined = errors[field];

        if (code === undefined) {
            return undefined;
        }

        return t(`errors.${code}`, {
            max: TEXT_LIMITS[field as keyof typeof TEXT_LIMITS],
        });
    };

    const setNumber = (key: NumericKey, value: number | undefined) => {
        const numbers = { ...form.numbers };

        if (value === undefined) {
            delete numbers[key];
        } else {
            numbers[key] = value;
        }

        onChange({ ...form, numbers });
    };

    const numeric = (key: NumericKey) => {
        const parameter = key as ParameterKey;
        const unit =
            units[key] ??
            defaultUnitFor(PARAMETERS[parameter].quantity, unitSystem);

        return (
            <ParameterField
                key={key}
                parameter={parameter}
                valueSi={form.numbers[key]}
                onChangeSi={(si) => setNumber(key, si)}
                unit={unit}
                onUnitChange={(next) =>
                    setUnits((current) => ({ ...current, [key]: next }))
                }
                status={errors[key] === undefined ? 'none' : 'error'}
                statusMessage={message(key)}
            />
        );
    };

    const text = (
        field: 'brand' | 'model' | 'variant' | 'source' | 'contact_email',
        extra: {
            required?: boolean;
            hint?: string;
            placeholder?: string;
            type?: 'text' | 'email';
            label: string;
        },
    ) => (
        <TextInput
            label={extra.label}
            value={form[field]}
            onChange={(value) => onChange({ ...form, [field]: value })}
            maxLength={TEXT_LIMITS[field] + 20}
            required={extra.required}
            hint={extra.hint}
            placeholder={extra.placeholder}
            type={extra.type}
            error={message(field)}
            disabled={sending}
        />
    );

    const section = (title: string, children: React.ReactNode) => (
        <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-muted">{title}</h3>
            {children}
        </section>
    );

    return (
        <form
            noValidate
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}
            className="flex flex-col gap-4"
        >
            <p className="text-sm text-muted">{t('intro')}</p>

            {section(
                t('sections.identification'),
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {text('brand', {
                        label: t('fields.brand'),
                        required: true,
                    })}
                    {text('model', {
                        label: t('fields.model'),
                        required: true,
                    })}
                    {text('variant', {
                        label: t('fields.variant'),
                        hint: t('fields.variantHint'),
                    })}
                    <DriverTypeSelect
                        value={form.type === '' ? undefined : form.type}
                        onChange={(type) =>
                            onChange({ ...form, type: type ?? '' })
                        }
                        disabled={sending}
                    />
                </div>,
            )}

            {section(
                t('sections.required'),
                <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3">
                    {REQUIRED_KEYS.map(numeric)}
                </div>,
            )}

            {section(
                t('sections.optional'),
                <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-3">
                    <DiameterField
                        valueSi={form.numbers.nominal_diameter_m}
                        onChange={(si) => setNumber('nominal_diameter_m', si)}
                        error={message('nominal_diameter_m')}
                        unit={defaultUnitFor('length', unitSystem)}
                    />
                    {OPTIONAL_KEYS.filter(
                        (key) => key !== 'nominal_diameter_m',
                    ).map(numeric)}
                </div>,
            )}

            {section(
                t('sections.origin'),
                text('source', {
                    label: t('fields.source'),
                    required: true,
                    hint: t('fields.sourceHint'),
                    placeholder: t('fields.sourcePlaceholder'),
                }),
            )}

            {section(
                t('sections.contact'),
                text('contact_email', {
                    label: t('fields.email'),
                    hint: t('fields.emailHint'),
                    placeholder: t('fields.emailPlaceholder'),
                    type: 'email',
                }),
            )}

            <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
            >
                <label>
                    {t('fields.trap')}
                    <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={trap}
                        onChange={(event) => onTrapChange(event.target.value)}
                    />
                </label>
            </div>

            <div
                aria-live="polite"
                className="flex flex-col gap-2 empty:hidden"
            >
                {errorCount > 0 && failure === undefined && (
                    <p role="alert" className="text-sm text-status-error">
                        {t('errors.summary', { count: errorCount })}
                    </p>
                )}
                {failure !== undefined && (
                    <p
                        role="alert"
                        className={cn('text-sm', 'text-status-error')}
                    >
                        {failureMessage(failure, t)}
                    </p>
                )}
                {offline && (
                    <p id={offlineId} className="text-sm text-muted">
                        {t('offline')}
                    </p>
                )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
                <Button variant="quiet" onPress={onCancel} disabled={sending}>
                    {t('actions.cancel')}
                </Button>
                {failure !== undefined &&
                    failure.error !== 'alreadyInCatalog' &&
                    failure.error !== 'alreadyPending' && (
                        <Button
                            variant="secondary"
                            onPress={onRetry}
                            disabled={sending || offline}
                        >
                            {t('actions.retry')}
                        </Button>
                    )}
                <Button
                    variant="primary"
                    type="submit"
                    disabled={sending || offline}
                    aria-busy={sending}
                    aria-describedby={offline ? offlineId : undefined}
                >
                    {sending ? t('actions.sending') : t('actions.submit')}
                </Button>
            </div>
        </form>
    );
}

function failureMessage(
    failure: SubmitFailure,
    t: (key: string, options?: Record<string, unknown>) => string,
): string {
    if (failure.error === 'rateLimited') {
        return failure.retryAfterS === undefined
            ? t('failure.rateLimitedUnknown')
            : t('failure.rateLimited', {
                  minutes: Math.max(1, Math.ceil(failure.retryAfterS / 60)),
              });
    }

    return t(`failure.${failure.error}`);
}
