import { ChevronDown, Loader2, Send, WifiOff } from 'lucide-react';
import { useId, useState } from 'react';
import {
    Button as AriaButton,
    Disclosure,
    DisclosurePanel,
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
import { ImpedanceField } from '@/components/ui/impedance-field';
import { ParameterField } from '@/components/ui/parameter-field';
import { TextInput } from '@/components/ui/text-field';
import type { ManualState, SubmitFailure } from '@/hooks/use-submit-driver';
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
import type { AutoKeys } from '@/lib/submission/auto-derive';
import { fromSi, toSi } from '@/lib/units/convert';
import { formatOptionsFor, formatQuantity } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';
import { DriverTypeSelect } from './driver-type-select';
import { ManualFill } from './manual-fill';

type SubmitDriverFormProps = {
    form: SubmissionForm;
    onChange: (form: SubmissionForm) => void;
    trap: string;
    onTrapChange: (value: string) => void;
    errors: SubmissionErrors;
    failure: SubmitFailure | undefined;
    manual: ManualState;
    // Campos com valor calculado dos outros (inserido sozinho, editável).
    auto: AutoKeys;
    onFillManual: (file: File) => void;
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
                <Input
                    ref={entryRef}
                    placeholder={t('placeholder.example', {
                        ns: 'common',
                        value: formatQuantity(0.3, unit, locale),
                    })}
                    className={cn(FIELD_INPUT, 'num')}
                />
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
    manual,
    auto,
    onFillManual,
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
                calculatedLabel={
                    auto.has(key) ? t('fields.calculated') : undefined
                }
                status={
                    errors[key] !== undefined
                        ? 'error'
                        : manual.suspect.includes(key)
                          ? 'warn'
                          : 'none'
                }
                statusMessage={
                    message(key) ??
                    (manual.suspect.includes(key)
                        ? t('manual.suspect')
                        : undefined)
                }
            />
        );
    };

    const text = (
        field: 'brand' | 'model' | 'source' | 'contact_email',
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

    // Cada etapa é um cartão numerado: a pessoa vê de relance quantas faltam e onde está.
    const section = (
        step: number,
        title: string,
        children: React.ReactNode,
        note?: string,
    ) => (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-4">
            <header className="flex items-center gap-2.5">
                <span
                    aria-hidden="true"
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
                >
                    {step}
                </span>
                <h3 className="text-sm font-semibold">{title}</h3>
            </header>
            {note !== undefined && (
                <p className="-mt-1 text-xs text-muted">{note}</p>
            )}
            {children}
        </section>
    );

    const optionalKeys = OPTIONAL_KEYS.filter(
        (key) => key !== 'nominal_diameter_m',
    );
    const optionalFilled = [
        'nominal_diameter_m' as const,
        ...optionalKeys,
    ].filter((key) => form.numbers[key] !== undefined).length;
    const optionalIssues = [
        'nominal_diameter_m' as const,
        ...optionalKeys,
    ].some((key) => errors[key] !== undefined || manual.suspect.includes(key));
    // Abre sozinho quando há algo a ver (valor, erro ou suspeita); a pessoa pode fechar à vontade.
    const [optionalOpen, setOptionalOpen] = useState<boolean | undefined>();
    const optionalExpanded =
        optionalOpen ?? (optionalFilled > 0 || optionalIssues);

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

            <ManualFill
                manual={manual}
                offline={offline}
                sending={sending}
                onFill={onFillManual}
            />

            {section(
                1,
                t('sections.identification'),
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {text('brand', {
                        label: t('fields.brand'),
                        placeholder: t('fields.brandPlaceholder'),
                        required: true,
                    })}
                    {text('model', {
                        label: t('fields.model'),
                        placeholder: t('fields.modelPlaceholder'),
                        required: true,
                    })}
                    <ImpedanceField
                        label={t('fields.variant')}
                        value={form.variant}
                        onChange={(variant) => onChange({ ...form, variant })}
                        hint={t('fields.variantHint')}
                        placeholder="4"
                        error={message('variant')}
                        disabled={sending}
                    />
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
                2,
                t('sections.parameters'),
                <>
                    <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-semibold text-muted">
                            {t('sections.required')}
                        </h4>
                        <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
                            {REQUIRED_KEYS.map(numeric)}
                        </div>
                    </div>
                    <Disclosure
                        isExpanded={optionalExpanded}
                        onExpandedChange={setOptionalOpen}
                        className="flex flex-col gap-2 border-t border-border pt-3"
                    >
                        <AriaButton
                            slot="trigger"
                            className="flex h-7 w-fit cursor-default items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold text-muted outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:text-foreground"
                        >
                            <ChevronDown
                                aria-hidden="true"
                                className={cn(
                                    'size-3.5 motion-safe:transition-transform',
                                    optionalExpanded && 'rotate-180',
                                )}
                            />
                            {t('sections.optional')}
                            {optionalFilled > 0 && (
                                <span className="font-normal">
                                    {' '}
                                    {t('sections.optionalFilled', {
                                        count: optionalFilled,
                                    })}
                                </span>
                            )}
                        </AriaButton>
                        <DisclosurePanel>
                            <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
                                <DiameterField
                                    valueSi={form.numbers.nominal_diameter_m}
                                    onChange={(si) =>
                                        setNumber('nominal_diameter_m', si)
                                    }
                                    error={message('nominal_diameter_m')}
                                    unit={defaultUnitFor('length', unitSystem)}
                                />
                                {optionalKeys.map(numeric)}
                            </div>
                        </DisclosurePanel>
                    </Disclosure>
                </>,
            )}

            {section(
                3,
                t('sections.originContact'),
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {text('source', {
                        label: t('fields.source'),
                        required: true,
                        hint: t('fields.sourceHint'),
                        placeholder: t('fields.sourcePlaceholder'),
                    })}
                    {text('contact_email', {
                        label: t('fields.email'),
                        required: true,
                        hint: t('fields.emailHint'),
                        placeholder: t('fields.emailPlaceholder'),
                        type: 'email',
                    })}
                </div>,
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
                    <p
                        role="alert"
                        className="rounded-md border border-status-error/40 bg-status-error/10 px-3 py-2 text-sm text-status-error"
                    >
                        {t('errors.summary', { count: errorCount })}
                    </p>
                )}
                {failure !== undefined && (
                    <p
                        role="alert"
                        className="rounded-md border border-status-error/40 bg-status-error/10 px-3 py-2 text-sm text-status-error"
                    >
                        {failureMessage(failure, t)}
                    </p>
                )}
                {offline && (
                    <p
                        id={offlineId}
                        className="flex items-center gap-2 rounded-md border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-sm"
                    >
                        <WifiOff
                            aria-hidden="true"
                            className="size-4 shrink-0"
                        />
                        {t('offline')}
                    </p>
                )}
            </div>

            {/* Rodapé fixo na base do diálogo: enviar e cancelar ficam à mão mesmo com o formulário rolado. */}
            <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-border bg-surface px-5 py-3">
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
                    className="h-9 min-w-32"
                >
                    {sending ? (
                        <Loader2
                            aria-hidden="true"
                            className="size-4 animate-spin"
                        />
                    ) : (
                        <Send aria-hidden="true" className="size-4" />
                    )}
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
