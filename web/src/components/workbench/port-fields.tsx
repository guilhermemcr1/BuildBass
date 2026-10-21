import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { twoChambers } from '@/engine';
import type { PortInput } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useParameterField } from './use-parameter-field';

type PortShape = PortInput['shape'];

const EMPTY_PORT: PortInput = { shape: 'round', count: 1 };

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

type Props = {
    // Na bandpass de 6ª ordem cada câmara tem o seu duto, com formato e medidas próprios.
    duct?: 'front' | 'rear';
};

export function PortFields({ duct = 'front' }: Props) {
    const { t } = useTranslation('workbench');
    const rear = duct === 'rear';
    const port = useActiveProject((state) =>
        rear ? (state.data.box.port_rear ?? EMPTY_PORT) : state.data.box.port,
    );
    const chambered = useActiveProject((state) =>
        twoChambers(state.data.box.type),
    );
    const setPort = useActiveProject((state) =>
        rear ? state.setPortRear : state.setPort,
    );
    const diameter = useParameterField(rear ? 'rear_diameter_m' : 'diameter_m');
    const width = useParameterField(rear ? 'rear_width_m' : 'width_m');
    const height = useParameterField(rear ? 'rear_height_m' : 'height_m');
    const base = useParameterField(rear ? 'rear_base_m' : 'base_m');
    const count = useParameterField(rear ? 'rear_port_count' : 'port_count');
    const title = rear
        ? 'port.titleRear'
        : chambered
          ? 'port.titleFront'
          : 'port.title';

    return (
        <fieldset className="flex flex-col gap-3">
            <legend className="mb-1.5 text-xs font-semibold text-muted">
                {t(title)}
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
