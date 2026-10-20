import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { PortInput } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useParameterField } from './use-parameter-field';

type PortShape = PortInput['shape'];

// Troca de formato: a quantidade fica e a altura passa entre retangular e triangular; as demais
// medidas não têm equivalente direto e ficam vazias.
function reshape(port: PortInput, shape: PortShape): PortInput {
    const height = 'height_m' in port ? port.height_m : undefined;

    switch (shape) {
        case 'round':
            return { shape, count: port.count };
        case 'rect':
            return { shape, height_m: height, count: port.count };
        case 'triangle':
            return { shape, height_m: height, count: port.count };
    }
}

export function PortFields() {
    const { t } = useTranslation('workbench');
    const port = useActiveProject((state) => state.data.box.port);
    const setPort = useActiveProject((state) => state.setPort);
    const diameter = useParameterField('diameter_m');
    const width = useParameterField('width_m');
    const height = useParameterField('height_m');
    const base = useParameterField('base_m');
    const count = useParameterField('port_count');

    return (
        <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-xs font-semibold text-muted">
                {t('port.title')}
            </legend>
            <SegmentedControl<PortShape>
                label={t('port.shape')}
                selected={port.shape}
                onChange={(shape) => {
                    if (shape !== port.shape) {
                        setPort(reshape(port, shape));
                    }
                }}
                options={[
                    { id: 'round', label: t('port.round') },
                    { id: 'rect', label: t('port.rect') },
                    { id: 'triangle', label: t('port.triangle') },
                ]}
                className="w-full"
            />
            {port.shape === 'round' && <ParameterField {...diameter} />}
            {port.shape === 'rect' && (
                <>
                    <ParameterField {...width} />
                    <ParameterField {...height} />
                </>
            )}
            {port.shape === 'triangle' && (
                <>
                    <ParameterField {...base} />
                    <ParameterField {...height} />
                </>
            )}
            <ParameterField {...count} />
        </fieldset>
    );
}
