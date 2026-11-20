import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SelectField } from '@/components/ui/select-field';
import { ShowMore } from '@/components/ui/show-more';
import { useActiveProject } from '@/hooks/use-active-project';
import { DRIVER_DIMENSION_PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { readField, writeDriverChoice } from '@/lib/project/fields';
import { DRIVER_PISTONS, DRIVER_SHAPES } from '@/lib/project/types';
import type { DriverPiston, DriverShape } from '@/lib/project/types';
import { DriverDrawing, useDrawingFocus } from './driver-drawing';
import { useParameterField } from './use-parameter-field';

function DimensionField({ parameter }: { parameter: ParameterKey }) {
    return <ParameterField {...useParameterField(parameter)} layout="row" />;
}

// Medidas físicas do alto-falante, como a aba "Dimensions" do BassBox: formato, tipo de pistão e as
// medidas A a G com o esquema ao lado. Não mexem na simulação; o recorte (C) e a profundidade
// alimentam o plano de corte, e o volume do motor (M-Vd) é descontado da caixa.
export function DriverDimensions({ open = false }: { open?: boolean }) {
    const { t } = useTranslation('workbench');
    const dims = useActiveProject((state) => state.data.driverDims);
    const filled = useActiveProject(
        (state) =>
            DRIVER_DIMENSION_PARAMETERS.filter(
                (key) => readField(state.data, key) !== undefined,
            ).length,
    );
    const apply = useActiveProject((state) => state.apply);
    const focus = useDrawingFocus();
    const shape: DriverShape = dims?.shape ?? 'round';
    const piston: DriverPiston = dims?.piston ?? 'cone';
    // O segundo lado só existe no recorte retangular.
    const keys = DRIVER_DIMENSION_PARAMETERS.filter(
        (key) => key !== 'drv_d_m' || shape === 'rect',
    );

    const body = (
        <>
            <div className="grid grid-cols-2 gap-2">
                <SelectField<DriverShape>
                    label={t('dims.shape.label')}
                    selected={shape}
                    onChange={(next) =>
                        apply((data) =>
                            writeDriverChoice(
                                data,
                                'shape',
                                next === 'round' ? undefined : next,
                            ),
                        )
                    }
                    options={DRIVER_SHAPES.map((id) => ({
                        id,
                        label: t(`dims.shape.${id}`),
                    }))}
                />
                <SelectField<DriverPiston>
                    label={t('dims.piston.label')}
                    selected={piston}
                    onChange={(next) =>
                        apply((data) =>
                            writeDriverChoice(
                                data,
                                'piston',
                                next === 'cone' ? undefined : next,
                            ),
                        )
                    }
                    options={DRIVER_PISTONS.map((id) => ({
                        id,
                        label: t(`dims.piston.${id}`),
                    }))}
                />
            </div>
            <div className="flex flex-col gap-1.5" {...focus.handlers}>
                {keys.map((key) => (
                    <DimensionField key={key} parameter={key} />
                ))}
            </div>
            <DriverDrawing
                shape={shape}
                piston={piston}
                active={focus.active}
            />
            <p className="text-[11px] leading-4 text-muted">{t('dims.hint')}</p>
        </>
    );

    // No modal as medidas já vêm abertas, sob um título, sem o "Mostrar mais".
    if (open) {
        return (
            <fieldset className="flex flex-col gap-3">
                <legend className="mb-1.5 text-xs font-semibold text-muted">
                    {t('dims.title')}
                </legend>
                {body}
            </fieldset>
        );
    }

    return (
        <ShowMore id="driverDims" title={t('dims.title')} filled={filled}>
            {body}
        </ShowMore>
    );
}
