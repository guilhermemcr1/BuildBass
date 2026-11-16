import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { twoChambers } from '@/engine';
import type { PortEnd, PortInput } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useParameterField } from './use-parameter-field';

type PortShape = PortInput['shape'];

const ENDS: PortEnd[] = [
    'flangedFree',
    'free',
    'flanged',
    'slotWall',
    'custom',
];

// Só o que não é o padrão fica no duto (flangeada + livre não é gravada); `end_k` só vale em
// `custom`.
function withEnd(port: PortInput, end: PortEnd): PortInput {
    const { end: _end, end_k, ...rest } = port;

    if (end === 'flangedFree') {
        return rest as PortInput;
    }

    return {
        ...rest,
        end,
        ...(end === 'custom' && end_k !== undefined ? { end_k } : {}),
    } as PortInput;
}

const EMPTY_PORT: PortInput = { shape: 'round', count: 1 };

// Troca de formato: a quantidade fica e a altura passa entre retangular e triangular; as demais
// medidas não têm equivalente direto e ficam vazias.
function reshape(port: PortInput, shape: PortShape): PortInput {
    const height = 'height_m' in port ? port.height_m : undefined;
    // A correção de ponta é da saída do duto, não do formato: passa adiante.
    const ends = {
        ...(port.end === undefined ? {} : { end: port.end }),
        ...(port.end_k === undefined ? {} : { end_k: port.end_k }),
    };

    switch (shape) {
        case 'round':
            return { shape, count: port.count, ...ends };
        case 'rect':
            return { shape, height_m: height, count: port.count, ...ends };
        case 'triangle':
            return { shape, height_m: height, count: port.count, ...ends };
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
    const factor = useParameterField(rear ? 'rear_end_k' : 'end_k');
    const end = port.end ?? 'flangedFree';
    const title = rear
        ? 'port.titleRear'
        : chambered
          ? 'port.titleFront'
          : 'port.title';

    return (
        <fieldset className="flex flex-col gap-2">
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
                size="sm"
                className="w-full"
            />
            <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2">
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
            </div>
            <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2">
                <SelectField<PortEnd>
                    label={t('port.end')}
                    selected={end}
                    onChange={(id) => setPort(withEnd(port, id))}
                    options={ENDS.map((id) => ({
                        id,
                        label: t(`port.end_${id}`),
                    }))}
                />
                {end === 'custom' && <ParameterField {...factor} />}
            </div>
        </fieldset>
    );
}
