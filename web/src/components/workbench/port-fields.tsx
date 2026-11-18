import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SelectField } from '@/components/ui/select-field';
import { ShowMore } from '@/components/ui/show-more';
import { twoChambers } from '@/engine';
import type { PortEnd, PortInput, PortMount } from '@/engine';
import { cornerMount } from '@/cutplan/plan';
import { useActiveProject } from '@/hooks/use-active-project';
import { PortDepthField } from './port-depth';
import { PortPlacementField } from './port-placement';
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
        // A posição no painel também não depende do formato.
        ...(port.mount === undefined ? {} : { mount: port.mount }),
        ...(port.placement === undefined ? {} : { placement: port.placement }),
        ...(port.rotation === undefined ? {} : { rotation: port.rotation }),
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
    const corners = cornerMount(port);
    const title = rear
        ? 'port.titleRear'
        : chambered
          ? 'port.titleFront'
          : 'port.title';

    return (
        <fieldset className="flex flex-col gap-2.5">
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
            {port.shape === 'triangle' && (
                <SelectField<PortMount>
                    label={t('port.mount')}
                    selected={port.mount ?? 'corners'}
                    onChange={(mount) => setPort({ ...port, mount })}
                    options={(['corners', 'free'] as const).map((id) => ({
                        id,
                        label: t(`port.mount_${id}`),
                    }))}
                />
            )}
            {/* Seção do recorte e quantidade lado a lado, cada campo com o nome em cima. */}
            <div className="grid grid-cols-3 items-start gap-2">
                {port.shape === 'round' && (
                    <ParameterField
                        {...diameter}
                        layout="stacked"
                        className="col-span-2"
                    />
                )}
                {port.shape === 'rect' && (
                    <>
                        <ParameterField {...width} layout="compact" />
                        <ParameterField {...height} layout="compact" />
                    </>
                )}
                {port.shape === 'triangle' && (
                    <>
                        <ParameterField {...base} layout="compact" />
                        <ParameterField {...height} layout="compact" />
                    </>
                )}
                <ParameterField {...count} layout="stacked" />
            </div>
            {corners && (
                <p className="text-[11px] leading-4 text-muted">
                    {t('port.cornersHint')}
                </p>
            )}
            {port.shape === 'triangle' &&
                port.mount !== 'free' &&
                Math.round(port.count) > 4 && (
                    <p className="text-[11px] leading-4 text-muted">
                        {t('port.cornersTooMany')}
                    </p>
                )}
            {/* Nos cantos a posição já está definida. */}
            {!corners && (
                <PortPlacementField
                    port={port}
                    setPort={setPort}
                    piece={rear ? 'back' : 'front'}
                />
            )}
            <PortDepthField port={port} rear={rear} />
            <ShowMore id="portAdvanced" title={t('port.more')}>
                <div className="flex flex-col gap-2">
                    <SelectField<PortEnd>
                        label={t('port.end')}
                        help={{
                            content: t('port.endHelp'),
                            label: t('common:help.of', {
                                parameter: t('port.end'),
                            }),
                        }}
                        selected={end}
                        onChange={(id) => setPort(withEnd(port, id))}
                        options={ENDS.map((id) => ({
                            id,
                            label: t(`port.end_${id}`),
                        }))}
                    />
                    {end === 'custom' && <ParameterField {...factor} />}
                </div>
            </ShowMore>
        </fieldset>
    );
}
