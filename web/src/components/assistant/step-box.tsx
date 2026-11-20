import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Bot, Box, Wand2 } from 'lucide-react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SliderField } from '@/components/ui/slider-field';
import { ValueTile } from '@/components/ui/value-tile';
import { AiSuggestDialog } from '@/components/workbench/ai-suggest-dialog';
import { EngineWarnings } from '@/components/workbench/engine-warnings';
import { PortDepthField } from '@/components/workbench/port-depth';
import { reshape } from '@/components/workbench/port-fields';
import { useParameterField } from '@/components/workbench/use-parameter-field';
import { resolveCutPlan } from '@/cutplan';
import { suggestBox } from '@/engine';
import type { Suggestion } from '@/engine';
import {
    activeProjectStore,
    useActiveProject,
} from '@/hooks/use-active-project';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { simulationOf } from '@/hooks/use-simulation';
import { PARAMETERS } from '@/lib/parameters';
import { writeInternalSize } from '@/lib/project/fields';
import type { ProjectData } from '@/lib/project/types';
import { formatQuantity } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

const Box3dView = lazy(() => import('@/components/workbench/box-3d-view'));

type SimpleType = 'closed' | 'vented';
type SizeMode = 'volume' | 'size';
type PortShape = 'round' | 'rect' | 'triangle';

const VB_SLIDER = { minSi: 0.005, maxSi: 0.25, scale: 'linear' } as const;
const FB_SLIDER = { minSi: 20, maxSi: 80, scale: 'log' } as const;
// Medidas externas de partida quando ainda não há caixa desenhada.
const DEFAULT_EXTERNAL = { w_m: 0.45, h_m: 0.38, d_m: 0.38 };

// Volume e sintonia do alinhamento clássico para o tipo escolhido, numa etapa só de desfazer.
function withClassic(data: ProjectData): {
    data: ProjectData;
    suggestion: Suggestion;
} {
    const suggestion = suggestBox(data);

    if (!suggestion.ok) {
        return { data, suggestion };
    }

    return {
        suggestion,
        data: {
            ...data,
            box: {
                ...data.box,
                vb_m3: suggestion.vb_m3,
                ...(suggestion.fb_hz === undefined
                    ? {}
                    : { fb_hz: suggestion.fb_hz }),
            },
        },
    };
}

// Passo 2: poucas perguntas (tipo, quantos alto-falantes, tamanho, sintonia e potência) com a
// caixa desenhada e os números principais ao lado. O resto fica na bancada (modo Pro).
export function StepBox() {
    const { t } = useTranslation('assistant');
    const boxType = useActiveProject((state) => state.data.box.type);
    const hasVolume = useActiveProject(
        (state) => state.data.box.vb_m3 !== undefined,
    );
    const port = useActiveProject((state) => state.data.box.port);
    const setPort = useActiveProject((state) => state.setPort);
    const apply = useActiveProject((state) => state.apply);
    const setBoxType = useActiveProject((state) => state.setBoxType);
    const [mode, setMode] = useState<SizeMode>('volume');
    const [classic, setClassic] = useState<Suggestion>();
    const count = useParameterField('driver_count');
    const volume = useParameterField('vb_m3');
    const tuning = useParameterField('fb_hz');
    const diameter = useParameterField('diameter_m');
    const portWidth = useParameterField('width_m');
    const portHeight = useParameterField('height_m');
    const portBase = useParameterField('base_m');
    const portCount = useParameterField('port_count');
    const power = useParameterField('power_w');
    const seeded = useRef(false);
    const simple = boxType === 'closed' || boxType === 'vented';

    const useClassic = () => {
        let result: Suggestion | undefined;

        apply((data) => {
            const next = withClassic(data);
            result = next.suggestion;

            return next.data;
        });
        setClassic(result);
    };

    // Caixa ainda sem volume: parte do alinhamento clássico, para já haver o que ver.
    useEffect(() => {
        if (seeded.current) {
            return;
        }

        seeded.current = true;
        const { data } = activeProjectStore().getState();

        if (
            data.box.vb_m3 === undefined &&
            (data.box.type === 'closed' || data.box.type === 'vented')
        ) {
            useClassic();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            <div className="flex min-w-0 flex-col gap-5">
                {!simple && (
                    <Banner tone="warn">
                        <span className="flex flex-wrap items-center gap-2">
                            {t('box.bandpass')}
                            <Button onPress={() => setBoxType('vented')}>
                                {t('box.useVented')}
                            </Button>
                        </span>
                    </Banner>
                )}
                <Question number={1} title={t('box.type.title')}>
                    <SegmentedControl<SimpleType>
                        label={t('box.type.title')}
                        selected={simple ? boxType : 'vented'}
                        onChange={setBoxType}
                        variant="tiles"
                        className="grid w-full grid-cols-2"
                        options={[
                            { id: 'closed', label: t('box.type.closed') },
                            { id: 'vented', label: t('box.type.vented') },
                        ]}
                    />
                    {simple && (
                        <p className="text-xs text-muted">
                            {t(`box.type.${boxType}Hint`)}
                        </p>
                    )}
                </Question>
                <Question number={2} title={t('box.count.title')}>
                    <ParameterField {...count} layout="row" />
                </Question>
                <Question
                    number={3}
                    title={t('box.size.title')}
                    action={
                        <Button variant="quiet" onPress={useClassic}>
                            <Wand2 aria-hidden="true" className="size-4" />
                            {t('box.classic')}
                        </Button>
                    }
                >
                    <SegmentedControl<SizeMode>
                        label={t('box.size.title')}
                        selected={mode}
                        onChange={setMode}
                        size="sm"
                        options={[
                            { id: 'volume', label: t('box.size.volume') },
                            { id: 'size', label: t('box.size.measures') },
                        ]}
                    />
                    {mode === 'volume' ? (
                        <SliderField
                            {...volume}
                            {...VB_SLIDER}
                            onLiveChangeSi={volume.onChangeSi}
                        />
                    ) : (
                        <ExternalSize />
                    )}
                    {classic !== undefined && (
                        <ClassicNote suggestion={classic} />
                    )}
                    {!hasVolume && (
                        <p className="text-xs text-muted">
                            {t('box.size.needed')}
                        </p>
                    )}
                </Question>
                {boxType === 'vented' && (
                    <Question number={4} title={t('box.tuning.title')}>
                        <p className="text-xs text-muted">
                            {t('box.tuning.hint')}
                        </p>
                        <SliderField
                            {...tuning}
                            {...FB_SLIDER}
                            onLiveChangeSi={tuning.onChangeSi}
                        />
                    </Question>
                )}
                {boxType === 'vented' && (
                    <Question number={5} title={t('box.port.title')}>
                        <p className="text-xs text-muted">
                            {t('box.port.hint')}
                        </p>
                        <SegmentedControl<PortShape>
                            label={t('box.port.shape')}
                            selected={port.shape}
                            onChange={(shape) => {
                                if (shape !== port.shape) {
                                    setPort(reshape(port, shape));
                                }
                            }}
                            size="sm"
                            className="w-full"
                            options={[
                                { id: 'round', label: t('box.port.round') },
                                { id: 'rect', label: t('box.port.rect') },
                                {
                                    id: 'triangle',
                                    label: t('box.port.triangle'),
                                },
                            ]}
                        />
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
                                    <ParameterField
                                        {...portWidth}
                                        layout="stacked"
                                    />
                                    <ParameterField
                                        {...portHeight}
                                        layout="stacked"
                                    />
                                </>
                            )}
                            {port.shape === 'triangle' && (
                                <>
                                    <ParameterField
                                        {...portBase}
                                        layout="stacked"
                                    />
                                    <ParameterField
                                        {...portHeight}
                                        layout="stacked"
                                    />
                                </>
                            )}
                            <ParameterField {...portCount} layout="stacked" />
                        </div>
                        {/* Profundidade do duto: sai da sintonia (trava na Fb) ou é digitada
                            (trava no comprimento, e a Fb sai dela). */}
                        <PortDepthField port={port} rear={false} />
                        {port.shape === 'triangle' && (
                            <p className="text-xs text-muted">
                                {t('box.port.triangleHint')}
                            </p>
                        )}
                    </Question>
                )}
                <Question
                    number={boxType === 'vented' ? 6 : 4}
                    title={t('box.power.title')}
                >
                    <p className="text-xs text-muted">{t('box.power.hint')}</p>
                    <ParameterField {...power} layout="row" />
                </Question>
            </div>
            <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0 lg:self-start">
                <AiBox enabled={simple} />
                <BoxPreview />
            </div>
        </div>
    );
}

// Sugestão por IA já no passo da caixa: propõe até três caixas para o uso descrito, cada uma
// conferida pelo simulador; aplicar troca tipo, volume, sintonia e duto aqui mesmo.
function AiBox({ enabled }: { enabled: boolean }) {
    const { t } = useTranslation('assistant');
    const offline = useOnlineStatus() === 'offline';
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    return (
        <section
            aria-labelledby="assistant-ai-box"
            className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-accent/5 p-4"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="assistant-ai-box" className="text-sm font-semibold">
                    {t('box.ai.title')}
                </h3>
                <Button
                    onPress={() => setOpen(true)}
                    disabled={offline || !enabled}
                >
                    <Bot aria-hidden="true" className="size-4" />
                    {t('box.ai.button')}
                </Button>
            </div>
            <p className="text-xs text-muted">
                {offline ? t('box.ai.offline') : t('box.ai.hint')}
            </p>
            {message !== null && <Banner>{message}</Banner>}
            <AiSuggestDialog
                open={open}
                onOpenChange={setOpen}
                onApplied={setMessage}
            />
        </section>
    );
}

function Question({
    number,
    title,
    action,
    children,
}: {
    number: number;
    title: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <fieldset className="flex min-w-0 flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <legend className="flex items-center gap-2 text-sm font-semibold">
                    <span
                        aria-hidden="true"
                        className="grid size-6 place-items-center rounded-full bg-accent/15 text-xs text-accent-soft tabular-nums"
                    >
                        {number}
                    </span>
                    {title}
                </legend>
                {action}
            </div>
            {children}
        </fieldset>
    );
}

function ClassicNote({ suggestion }: { suggestion: Suggestion }) {
    const { t } = useTranslation('assistant');

    if (suggestion.ok) {
        return <p className="text-xs text-muted">{t('box.classicApplied')}</p>;
    }

    if (suggestion.reason === 'qtsTooHigh') {
        return (
            <Banner tone="warn">
                {suggestion.recommend === 'closed'
                    ? t('box.classicFail.useClosed')
                    : t('box.classicFail.qtsTooHigh')}
            </Banner>
        );
    }

    return (
        <Banner tone="warn">{t(`box.classicFail.${suggestion.reason}`)}</Banner>
    );
}

const AXES = [
    ['dim_w_m', 'w_m'],
    ['dim_h_m', 'h_m'],
    ['dim_d_m', 'd_m'],
] as const;

// Medidas externas (largura, altura e profundidade) e a espessura da chapa: o volume interno, sem
// a espessura nas duas paredes de cada eixo, vira o Vb.
function ExternalSize() {
    const { t } = useTranslation('assistant');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const fieldUnits = useActiveProject((state) => state.data.fieldUnits);
    const setFieldUnit = useActiveProject((state) => state.setFieldUnit);
    const config = useActiveProject((state) => state.data.cutPlan);
    const apply = useActiveProject((state) => state.apply);
    const thickness = useParameterField('thickness_m');
    const cutPlan = useCutPlan();
    // Por que a medida não entrou: o eixo pequeno demais (com o mínimo) ou uma caixa que não fecha.
    const [error, setError] = useState<
        | { kind: 'tooSmall'; axis: 'w_m' | 'h_m' | 'd_m'; min_m: number }
        | { kind: 'invalid' }
        | undefined
    >();
    const external =
        cutPlan.status === 'ready'
            ? cutPlan.plan.dimensions.external
            : DEFAULT_EXTERNAL;

    // `quiet`: prévia ao vivo, a cada tecla. Medida intermediária ("4" a caminho de "450") não
    // acusa erro; o aviso só vem ao confirmar o campo.
    const write = (axis: 'w_m' | 'h_m' | 'd_m', si: number, quiet = false) => {
        const wall = 2 * resolveCutPlan(config).thickness_m;
        const next = { ...external, [axis]: si };
        const internal = {
            w_m: next.w_m - wall,
            h_m: next.h_m - wall,
            d_m: next.d_m - wall,
        };
        const small = (['w_m', 'h_m', 'd_m'] as const).find(
            (key) => internal[key] <= 0,
        );

        if (small !== undefined) {
            if (!quiet) {
                setError({ kind: 'tooSmall', axis: small, min_m: wall });
            }
            return;
        }

        let changed = false;

        apply((data) => {
            const result = writeInternalSize(data, internal);
            changed = result !== data;

            return result;
        });
        if (changed) {
            setError(undefined);
        } else if (!quiet) {
            setError({ kind: 'invalid' });
        }
    };
    const lengthUnit: UnitId =
        fieldUnits.dim_w_m ?? defaultUnitFor('length', unitSystem);

    return (
        <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-3 gap-2">
                {AXES.map(([key, axis]) => {
                    const unit: UnitId =
                        fieldUnits[key] ??
                        defaultUnitFor(PARAMETERS[key].quantity, unitSystem);

                    return (
                        <ParameterField
                            key={key}
                            parameter={key}
                            layout="stacked"
                            labelContext={t('box.size.external')}
                            valueSi={external[axis]}
                            unit={unit}
                            onUnitChange={(next) => setFieldUnit(key, next)}
                            onLiveChangeSi={(si) => write(axis, si, true)}
                            onChangeSi={(si) => {
                                if (si !== undefined) {
                                    write(axis, si);
                                }
                            }}
                        />
                    );
                })}
            </div>
            <ParameterField
                {...thickness}
                onLiveChangeSi={thickness.onChangeSi}
                layout="row"
            />
            <p className="text-xs text-muted">{t('box.size.externalHint')}</p>
            {error !== undefined && (
                <div role="alert">
                    <Banner tone="warn">
                        {error.kind === 'tooSmall'
                            ? t('box.size.tooSmall', {
                                  axis: t(`box.size.axis.${error.axis}`),
                                  min: `${formatQuantity(error.min_m, lengthUnit, locale)} ${findUnit(lengthUnit).symbol}`,
                              })
                            : t('box.size.invalid')}
                    </Banner>
                </div>
            )}
        </div>
    );
}

// Desenho da caixa e os números que ajudam a decidir; os avisos do motor logo abaixo.
function BoxPreview() {
    const { t } = useTranslation(['assistant', 'workbench']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const data = useActiveProject((state) => state.data);
    const { results } = simulationOf(data);
    const cutPlan = useCutPlan();
    const length = defaultUnitFor('length', unitSystem);
    const vented = data.box.type === 'vented';
    const external =
        cutPlan.status === 'ready'
            ? cutPlan.plan.dimensions.external
            : undefined;

    return (
        <aside
            aria-label={t('assistant:box.previewTitle')}
            className="flex min-w-0 flex-col gap-3"
        >
            {cutPlan.status === 'ready' ? (
                <Suspense
                    fallback={<div className="h-72" aria-hidden="true" />}
                >
                    <div className="rounded-md border border-border bg-raised p-2">
                        <Box3dView plan={cutPlan.plan} compact />
                    </div>
                </Suspense>
            ) : (
                <div
                    aria-hidden="true"
                    className="flex h-48 items-center justify-center rounded-md border border-dashed border-border text-muted"
                >
                    <Box className="size-8" />
                </div>
            )}
            {external !== undefined && (
                <p className="text-center text-xs text-muted tabular-nums">
                    {t('assistant:box.externalSize', {
                        size: [external.w_m, external.h_m, external.d_m]
                            .map((si) => formatQuantity(si, length, locale))
                            .join(' × '),
                        unit: findUnit(length).symbol,
                    })}
                </p>
            )}
            <div className="grid grid-cols-2 gap-2">
                <ValueTile
                    label={t('assistant:box.results.net')}
                    valueSi={results.net_volume_m3}
                    unit={defaultUnitFor('volume', unitSystem)}
                />
                <ValueTile
                    label={t('workbench:results.f3')}
                    valueSi={results.f3_hz}
                    unit="Hz"
                />
                {vented ? (
                    <>
                        <ValueTile
                            label={t('assistant:box.results.portLength')}
                            valueSi={results.port_length_m}
                            unit={length}
                        />
                        <ValueTile
                            label={t('assistant:box.results.velocity')}
                            valueSi={results.port_velocity_max_ms}
                            unit="m/s"
                        />
                    </>
                ) : (
                    <ValueTile
                        label={t('workbench:results.qtc')}
                        valueSi={results.qtc}
                        unit="none"
                    />
                )}
            </div>
            <EngineWarnings />
        </aside>
    );
}
