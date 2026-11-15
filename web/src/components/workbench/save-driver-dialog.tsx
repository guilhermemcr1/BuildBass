import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ImpedanceField } from '@/components/ui/impedance-field';
import { isImpedance } from '@/lib/impedance';
import { TextInput } from '@/components/ui/text-field';
import { CUT_PLAN_LIMITS } from '@/cutplan/config';
import { EXAMPLES } from '@/lib/parameters';
import {
    SAVED_DRIVER_LIMITS,
    SAVED_DRIVERS_MAX,
    identityOf,
} from '@/lib/saved-drivers/types';
import type { SavedDriver, SavedDriverDraft } from '@/lib/saved-drivers/types';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { useSavedDrivers } from '@/stores/saved-drivers';
import type { DriverType } from '@/lib/project/types';
import { DriverTypeSelect } from './driver-type-select';
import { LengthInput } from './length-input';

type SaveDriverDialogProps = {
    // Ponto de partida do formulário; quem abre o diálogo monta ele a cada abertura.
    initial: SavedDriverDraft;
    // Presente = edição de um item da lista (não cria outro).
    editing?: SavedDriver;
    onClose: () => void;
};

type TextField = 'brand' | 'model' | 'variant';
type Problem = 'required' | 'tooLong' | 'impedance' | 'duplicateOther' | 'full';

const TEXT_LIMITS: Record<TextField, { min: number; max: number }> = {
    brand: SAVED_DRIVER_LIMITS.brand,
    model: SAVED_DRIVER_LIMITS.model,
    variant: SAVED_DRIVER_LIMITS.variant,
};

function textProblem(field: TextField, value: string): Problem | undefined {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
        return field === 'variant' ? undefined : 'required';
    }

    if (field === 'variant' && !isImpedance(trimmed)) {
        return 'impedance';
    }

    return trimmed.length > TEXT_LIMITS[field].max ? 'tooLong' : undefined;
}

// Salvar (ou editar) um alto-falante da lista "Meus alto-falantes" (specs/008, FR-023–027).
// O formulário é uma cópia: não altera o projeto. Os parâmetros T/S vêm do `initial`.
export default function SaveDriverDialog({
    initial,
    editing,
    onClose,
}: SaveDriverDialogProps) {
    const { t } = useTranslation('workbench');
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unit = defaultUnitFor('length', unitSystem);
    const items = useSavedDrivers((state) => state.items);
    const save = useSavedDrivers((state) => state.save);
    const replace = useSavedDrivers((state) => state.replace);
    const [brand, setBrand] = useState(initial.brand);
    const [model, setModel] = useState(initial.model);
    const [variant, setVariant] = useState(initial.variant ?? '');
    const [type, setType] = useState<DriverType | undefined>(initial.type);
    const [diameter, setDiameter] = useState(initial.nominal_diameter_m);
    const [cutout, setCutout] = useState(initial.cutout_m);
    const [depth, setDepth] = useState(initial.depth_m);
    const [submitted, setSubmitted] = useState(false);
    const [clash, setClash] = useState<SavedDriver | undefined>(undefined);
    const [full, setFull] = useState(false);
    const paramCount = Object.keys(initial.driver).length;

    const draft = (): SavedDriverDraft => {
        const trimmedVariant = variant.trim();

        return {
            brand: brand.trim(),
            model: model.trim(),
            ...(trimmedVariant === '' ? {} : { variant: trimmedVariant }),
            ...(type === undefined ? {} : { type }),
            driver: initial.driver,
            ...(diameter === undefined ? {} : { nominal_diameter_m: diameter }),
            ...(cutout === undefined ? {} : { cutout_m: cutout }),
            ...(depth === undefined ? {} : { depth_m: depth }),
        };
    };

    const problems: Partial<Record<TextField, Problem>> = {
        brand: textProblem('brand', brand),
        model: textProblem('model', model),
        variant: textProblem('variant', variant),
    };
    const invalid = Object.values(problems).some(
        (problem) => problem !== undefined,
    );

    // Editar para o nome de outro item da lista é conflito; o próprio item não conta.
    const other = items.find(
        (item) =>
            item.id !== editing?.id && identityOf(item) === identityOf(draft()),
    );

    const message = (field: TextField): string | undefined => {
        const problem =
            problems[field] ??
            (field === 'model' && editing !== undefined && other !== undefined
                ? 'duplicateOther'
                : undefined);

        if (!submitted || problem === undefined) {
            return undefined;
        }

        return t(`saved.errors.${problem}`, { max: TEXT_LIMITS[field].max });
    };

    const submit = () => {
        setSubmitted(true);

        if (invalid) {
            return;
        }

        if (editing !== undefined) {
            if (other === undefined) {
                replace(editing.id, draft());
                onClose();
            }

            return;
        }

        const result = save(draft());

        if (result.status === 'saved') {
            onClose();
        } else if (result.status === 'duplicate') {
            setClash(result.existing);
        } else {
            setFull(true);
        }
    };

    if (clash !== undefined) {
        const existing = clash;

        return (
            <Dialog
                title={t('saved.duplicate.title')}
                open
                onOpenChange={(open) => {
                    if (!open) {
                        setClash(undefined);
                    }
                }}
            >
                <p className="text-sm text-muted">
                    {t('saved.duplicate.body', {
                        name: [existing.brand, existing.model].join(' '),
                    })}
                </p>
                <div className="flex justify-end gap-2">
                    <Button variant="quiet" onPress={() => setClash(undefined)}>
                        {t('saved.actions.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        autoFocus
                        onPress={() => {
                            replace(existing.id, draft());
                            onClose();
                        }}
                    >
                        {t('saved.actions.replace')}
                    </Button>
                </div>
            </Dialog>
        );
    }

    return (
        <Dialog
            title={
                editing === undefined
                    ? t('saved.saveTitle')
                    : t('saved.editTitle')
            }
            open
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <form
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
                className="flex flex-col gap-3"
            >
                <div className="grid gap-3 sm:grid-cols-2">
                    <TextInput
                        label={t('saved.fields.brand')}
                        placeholder={t('identity.brandPlaceholder')}
                        value={brand}
                        onChange={setBrand}
                        required
                        error={message('brand')}
                    />
                    <TextInput
                        label={t('saved.fields.model')}
                        placeholder={t('identity.modelPlaceholder')}
                        value={model}
                        onChange={setModel}
                        required
                        error={message('model')}
                    />
                    <ImpedanceField
                        label={t('saved.fields.variant')}
                        placeholder={t('identity.variantPlaceholder')}
                        value={variant}
                        onChange={setVariant}
                        error={message('variant')}
                    />
                    <DriverTypeSelect value={type} onChange={setType} />
                </div>
                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-1.5 text-xs font-semibold text-muted">
                        {t('saved.physical')}
                    </legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                        <LengthInput
                            label={t('saved.fields.diameter')}
                            valueSi={diameter}
                            onChange={setDiameter}
                            range={SAVED_DRIVER_LIMITS.nominal_diameter_m}
                            unit={unit}
                            example={EXAMPLES.drv_a_m}
                        />
                        <LengthInput
                            label={t('saved.fields.cutout')}
                            valueSi={cutout}
                            onChange={setCutout}
                            range={CUT_PLAN_LIMITS.cutout_m}
                            unit={unit}
                            example={EXAMPLES.cutout_m}
                        />
                        <LengthInput
                            label={t('saved.fields.depth')}
                            valueSi={depth}
                            onChange={setDepth}
                            range={SAVED_DRIVER_LIMITS.depth_m}
                            unit={unit}
                            example={EXAMPLES.drv_g_m}
                        />
                    </div>
                </fieldset>
                <p className="text-xs text-muted">
                    {t('saved.params', { count: paramCount })}
                </p>
                {full && (
                    <p role="alert" className="text-sm text-status-error">
                        {t('saved.errors.full', { max: SAVED_DRIVERS_MAX })}
                    </p>
                )}
                <div className="flex justify-end gap-2">
                    <Button variant="quiet" onPress={onClose}>
                        {t('saved.actions.cancel')}
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={brand.trim() === '' || model.trim() === ''}
                    >
                        {t('saved.actions.save')}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}
