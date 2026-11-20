import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SelectField } from '@/components/ui/select-field';
import { PARAMETERS } from '@/lib/parameters';
import { DRIVER_PISTONS, DRIVER_SHAPES } from '@/lib/project/types';
import type { DriverPiston, DriverShape } from '@/lib/project/types';
import { DIMENSION_KEYS } from '@/lib/submission/schema';
import type {
    DimensionKey,
    SubmissionErrorCode,
    SubmissionForm,
} from '@/lib/submission/schema';
import { defaultUnitFor } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { DriverDrawing, useDrawingFocus } from './driver-drawing';

type SubmitDimensionsProps = {
    form: SubmissionForm;
    onChange: (form: SubmissionForm) => void;
    errors: Partial<Record<DimensionKey, SubmissionErrorCode>>;
    disabled: boolean;
};

// Medidas físicas opcionais do envio, as mesmas da bancada (formato, pistão e cotas A–G) com o
// esquema ao lado. Ao aprovar, seguem para o catálogo e montam o desenho do alto-falante.
export function SubmitDimensions({
    form,
    onChange,
    errors,
    disabled,
}: SubmitDimensionsProps) {
    const { t } = useTranslation(['submission', 'workbench']);
    const focus = useDrawingFocus();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const [units, setUnits] = useState<Partial<Record<DimensionKey, UnitId>>>(
        {},
    );
    const shape: DriverShape = form.shape === '' ? 'round' : form.shape;
    const piston: DriverPiston = form.piston === '' ? 'cone' : form.piston;
    // O segundo lado só existe no formato retangular.
    const keys = DIMENSION_KEYS.filter(
        (key) => key !== 'drv_d_m' || shape === 'rect',
    );

    const setDim = (key: DimensionKey, value: number | undefined) => {
        const dims = { ...form.dims };

        if (value === undefined) {
            delete dims[key];
        } else {
            dims[key] = value;
        }

        onChange({ ...form, dims });
    };

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_minmax(0,220px)]">
            <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                    <SelectField<DriverShape | 'none'>
                        label={t('workbench:dims.shape.label')}
                        selected={form.shape === '' ? 'none' : form.shape}
                        disabled={disabled}
                        onChange={(next) =>
                            onChange({
                                ...form,
                                shape: next === 'none' ? '' : next,
                            })
                        }
                        options={[
                            { id: 'none', label: t('dims.none') },
                            ...DRIVER_SHAPES.map((id) => ({
                                id,
                                label: t(`workbench:dims.shape.${id}`),
                            })),
                        ]}
                    />
                    <SelectField<DriverPiston | 'none'>
                        label={t('workbench:dims.piston.label')}
                        selected={form.piston === '' ? 'none' : form.piston}
                        disabled={disabled}
                        onChange={(next) =>
                            onChange({
                                ...form,
                                piston: next === 'none' ? '' : next,
                            })
                        }
                        options={[
                            { id: 'none', label: t('dims.none') },
                            ...DRIVER_PISTONS.map((id) => ({
                                id,
                                label: t(`workbench:dims.piston.${id}`),
                            })),
                        ]}
                    />
                </div>
                <div className="flex flex-col gap-1.5" {...focus.handlers}>
                    {keys.map((key) => (
                        <ParameterField
                            key={key}
                            parameter={key}
                            layout="row"
                            valueSi={form.dims[key]}
                            onChangeSi={(si) => setDim(key, si)}
                            unit={
                                units[key] ??
                                defaultUnitFor(
                                    PARAMETERS[key].quantity,
                                    unitSystem,
                                )
                            }
                            onUnitChange={(next) =>
                                setUnits((current) => ({
                                    ...current,
                                    [key]: next,
                                }))
                            }
                            status={
                                errors[key] !== undefined ? 'error' : 'none'
                            }
                            statusMessage={
                                errors[key] === undefined
                                    ? undefined
                                    : t(`errors.${errors[key]}`)
                            }
                        />
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-2 self-start rounded-md border border-border bg-surface p-3">
                <DriverDrawing
                    shape={shape}
                    piston={piston}
                    active={focus.active}
                />
                <p className="text-[11px] leading-4 text-muted">
                    {t('dims.hint')}
                </p>
            </div>
        </div>
    );
}
