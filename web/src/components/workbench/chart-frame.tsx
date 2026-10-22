import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import uPlot from 'uplot';
import type { SeriesColor } from '@/lib/project/types';
import { cn } from '@/lib/utils';
import { RING_SWATCH, SWATCH } from './swatch';
import 'uplot/dist/uPlot.min.css';

export type ChartSeries = {
    id: string;
    label: string;
    color: SeriesColor;
    // Projeto ativo: linha mais grossa.
    emphasis: boolean;
    // Já na unidade exibida; null = sem valor nesse ponto.
    values: (number | null)[];
    // Traço tracejado, para separar duas séries do mesmo projeto sem depender só da cor.
    dashed?: boolean;
};

export type ChartLimit = {
    value: number;
    tone: 'warn' | 'error';
    label: string;
    // Redesenha em destaque o trecho de cada série acima do limite (ex.: excursão > Xmax).
    highlight?: boolean;
};

type ChartFrameProps = {
    xLabel: string;
    yLabel: string;
    // Nome da grandeza para o leitor de tela (o gráfico é um grupo focável).
    label: string;
    formatValue: (value: number) => string;
    formatFrequency: (hz: number) => string;
    frequencies: readonly number[];
    series: ChartSeries[];
    limits?: ChartLimit[];
    // Faixa fixa do eixo y; sem ela, o uPlot ajusta aos dados.
    yRange?: [number, number];
    yIncrs?: number[];
    // Faixa visível do eixo de frequência (Hz). Quem manda é o painel; o arrastar do mouse pede
    // uma faixa nova por `onZoom` e o duplo clique pede para voltar por `onZoomReset`.
    xRange: [number, number];
    onZoom?: (range: [number, number]) => void;
    onZoomReset?: () => void;
    // Rótulo do maior valor de cada curva na faixa visível ("Pico").
    peakLabel: string;
};

type Layout = {
    series: [string, string, number, boolean, boolean][];
    limits: ChartLimit[];
    yRange?: [number, number];
    yIncrs?: number[];
};

// Arrastar menos que isso é um clique, não um zoom; e o zoom não passa de 1,2× entre as pontas.
const MIN_DRAG_PX = 8;
const MIN_ZOOM_RATIO = 1.2;

function token(name: string): string {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
}

// Num eixo log só 1, 2 e 5 de cada década recebem rótulo; as demais linhas ficam só na grade. Com
// zoom de poucas oitavas todas as linhas ganham rótulo, senão sobraria quase nada para ler.
function frequencyTick(value: number | null, all: boolean): string {
    if (value === null) {
        return '';
    }

    const mantissa = Number(
        (value / 10 ** Math.floor(Math.log10(value))).toPrecision(6),
    );

    if (!all && ![1, 2, 5].includes(mantissa)) {
        return '';
    }

    return value >= 1000 ? `${value / 1000}k` : String(value);
}

// Pontos do eixo de frequência: 1…9 de cada década; se a faixa visível for estreita (zoom), passa
// para meio em meio e depois para décimo em décimo até haver pelo menos 4 pontos para ler.
function frequencySplits(min: number, max: number): number[] {
    for (const step of [10, 5, 1]) {
        const ticks: number[] = [];

        for (
            let decade = Math.floor(Math.log10(min));
            decade <= Math.ceil(Math.log10(max));
            decade++
        ) {
            const base = 10 ** decade;

            // Mantissa em décimos (10 = 1,0 … 99 = 9,9), inteira para não acumular erro de ponto
            // flutuante.
            for (let tenths = 10; tenths < 100; tenths += step) {
                const value = Number(((tenths * base) / 10).toPrecision(6));

                if (value >= min && value <= max) {
                    ticks.push(value);
                }
            }
        }

        if (ticks.length >= 4 || step === 1) {
            return ticks;
        }
    }

    return [];
}

type Peak = { index: number; value: number };

// Maior valor da curva dentro da faixa visível (o pico exibido no tooltip e marcado no gráfico).
function peakOf(
    frequencies: readonly number[],
    values: (number | null)[],
    [min, max]: [number, number],
): Peak | undefined {
    let best: Peak | undefined;

    values.forEach((value, index) => {
        const frequency = frequencies[index];

        if (
            value === null ||
            frequency === undefined ||
            frequency < min ||
            frequency > max
        ) {
            return;
        }

        if (best === undefined || value > best.value) {
            best = { index, value };
        }
    });

    return best;
}

function chartData(
    frequencies: readonly number[],
    series: ChartSeries[],
    limits: ChartLimit[],
): uPlot.AlignedData {
    return [
        [...frequencies],
        ...series.map((item) => item.values),
        ...limits.map((limit) => frequencies.map(() => limit.value)),
        ...limits
            .filter((limit) => limit.highlight === true)
            .flatMap((limit) =>
                series.map((item) =>
                    item.values.map((value) =>
                        value !== null && value > limit.value ? value : null,
                    ),
                ),
            ),
    ];
}

// Gráfico com eixo de frequência logarítmico. As cores vêm dos tokens do tema (lidas em tempo
// de execução) e o gráfico é refeito quando o tema ou a composição das séries muda; mudanças só
// de valores usam setData.
// Passos do cursor pelo teclado: um ponto, ou dez com Shift (research.md §13).
function nextIndex(
    event: KeyboardEvent,
    current: number | null,
    last: number,
): number | null {
    const step = event.shiftKey ? 10 : 1;
    const from = current ?? 0;

    switch (event.key) {
        case 'ArrowRight':
            return current === null ? 0 : Math.min(last, from + step);
        case 'ArrowLeft':
            return current === null ? last : Math.max(0, from - step);
        case 'Home':
            return 0;
        case 'End':
            return last;
        default:
            return null;
    }
}

export default function ChartFrame({
    xLabel,
    yLabel,
    label,
    formatValue,
    formatFrequency,
    frequencies,
    series,
    limits = [],
    yRange,
    yIncrs,
    xRange,
    onZoom,
    onZoomReset,
    peakLabel,
}: ChartFrameProps) {
    const container = useRef<HTMLDivElement>(null);
    const plotRef = useRef<uPlot | undefined>(undefined);
    const data = chartData(frequencies, series, limits);
    const dataRef = useRef(data);
    // Lidos de dentro dos hooks do uPlot, que nascem uma vez por composição de séries.
    const xRangeRef = useRef(xRange);
    const zoomRef = useRef({ onZoom, onZoomReset });
    const colorsRef = useRef<string[]>([]);
    // Ponto sob o cursor (mouse ou teclado) e se ele veio do teclado (só então é anunciado).
    const [cursor, setCursor] = useState<{
        index: number;
        left: number;
    } | null>(null);
    const [announce, setAnnounce] = useState(false);

    const layout = JSON.stringify({
        series: series.map(({ id, label, color, emphasis, dashed }) => [
            id,
            label,
            color,
            emphasis,
            dashed === true,
        ]),
        limits,
        yRange,
        yIncrs,
    } satisfies Layout);

    useEffect(() => {
        dataRef.current = data;
        xRangeRef.current = xRange;
        zoomRef.current = { onZoom, onZoomReset };
        // setData recalcula as escalas, e a do x lê `xRangeRef`: mudar a faixa passa por aqui.
        plotRef.current?.setData(data);
    });

    useEffect(() => {
        const element = container.current;

        if (element === null) {
            return;
        }

        const config = JSON.parse(layout) as Layout;

        const build = () => {
            plotRef.current?.destroy();
            colorsRef.current = config.series.map(([, , color]) =>
                token(`--series-${color}`),
            );

            const grid = { stroke: token('--border'), width: 1 };
            const axis = {
                stroke: token('--muted'),
                grid,
                ticks: grid,
                font: '11px "IBM Plex Mono", monospace',
                labelFont: '12px "Archivo Variable", sans-serif',
            };

            plotRef.current = new uPlot(
                {
                    width: element.clientWidth,
                    height: element.clientHeight,
                    legend: { show: false },
                    cursor: {
                        x: true,
                        y: false,
                        drag: {
                            x: true,
                            y: false,
                            setScale: false,
                            dist: MIN_DRAG_PX,
                        },
                        points: { size: 7 },
                    },
                    hooks: {
                        ready: [
                            (plot) => {
                                plot.over.addEventListener('dblclick', () =>
                                    zoomRef.current.onZoomReset?.(),
                                );
                            },
                        ],
                        // Arrastar na horizontal pede o zoom; o retângulo some em seguida.
                        setSelect: [
                            (plot) => {
                                const { left, width } = plot.select;

                                plot.setSelect(
                                    { left: 0, top: 0, width: 0, height: 0 },
                                    false,
                                );

                                if (width < MIN_DRAG_PX) {
                                    return;
                                }

                                const low = plot.posToVal(left, 'x');
                                const high = plot.posToVal(left + width, 'x');

                                if (high / low >= MIN_ZOOM_RATIO) {
                                    zoomRef.current.onZoom?.([low, high]);
                                }
                            },
                        ],
                        // O pico de cada curva, marcado com um anel na cor dela.
                        draw: [
                            (plot) => {
                                const { ctx } = plot;
                                const { left, top, width, height } = plot.bbox;
                                const frequencies = dataRef
                                    .current[0] as number[];

                                ctx.save();
                                ctx.beginPath();
                                ctx.rect(left, top, width, height);
                                ctx.clip();

                                colorsRef.current.forEach(
                                    (stroke, position) => {
                                        const peak = peakOf(
                                            frequencies,
                                            dataRef.current[position + 1] as (
                                                | number
                                                | null
                                            )[],
                                            xRangeRef.current,
                                        );

                                        if (peak === undefined) {
                                            return;
                                        }

                                        const x = plot.valToPos(
                                            frequencies[peak.index],
                                            'x',
                                            true,
                                        );
                                        const y = plot.valToPos(
                                            peak.value,
                                            'y',
                                            true,
                                        );

                                        ctx.beginPath();
                                        ctx.arc(
                                            x,
                                            y,
                                            5 * devicePixelRatio,
                                            0,
                                            2 * Math.PI,
                                        );
                                        ctx.lineWidth = 2 * devicePixelRatio;
                                        ctx.strokeStyle = stroke;
                                        ctx.fillStyle = token('--surface');
                                        ctx.fill();
                                        ctx.stroke();
                                    },
                                );

                                ctx.restore();
                            },
                        ],
                        setCursor: [
                            (plot) => {
                                const index = plot.cursor.idx;
                                const left =
                                    index === undefined || index === null
                                        ? undefined
                                        : plot.valToPos(
                                              plot.data[0][index],
                                              'x',
                                          ) + plot.over.offsetLeft;

                                // setData a cada render também chama este hook: sem mudança,
                                // devolver o mesmo estado evita um ciclo de renders.
                                setCursor((previous) => {
                                    if (index === undefined || index === null) {
                                        return null;
                                    }

                                    return previous?.index === index &&
                                        previous.left === left
                                        ? previous
                                        : { index, left: left ?? 0 };
                                });
                            },
                        ],
                    },
                    scales: {
                        x: {
                            time: false,
                            distr: 3,
                            range: () => xRangeRef.current,
                        },
                        y:
                            config.yRange === undefined
                                ? {}
                                : { range: config.yRange },
                    },
                    axes: [
                        {
                            ...axis,
                            label: xLabel,
                            splits: (_plot, _axis, min, max) =>
                                frequencySplits(min, max),
                            // O filtro padrão do eixo log esconde tudo que não é década; os
                            // rótulos são escolhidos em `values`.
                            filter: (_plot, splits) => splits,
                            values: (plot, ticks) => {
                                const { min, max } = plot.scales.x;
                                const narrow =
                                    min !== undefined &&
                                    max !== undefined &&
                                    max / min < 6;

                                return ticks.map((tick) =>
                                    frequencyTick(tick, narrow),
                                );
                            },
                        },
                        {
                            ...axis,
                            label: yLabel,
                            size: 56,
                            ...(config.yIncrs === undefined
                                ? {}
                                : { incrs: config.yIncrs }),
                        },
                    ],
                    series: [
                        {},
                        ...config.series.map(
                            ([, label, color, emphasis, dashed]) => ({
                                label,
                                stroke: token(`--series-${color}`),
                                width: emphasis ? 2.5 : 1.5,
                                // Com zoom o uPlot desenharia um ponto por amostra.
                                points: { show: false },
                                ...(dashed ? { dash: [8, 5] } : {}),
                            }),
                        ),
                        ...config.limits.map((limit) => ({
                            label: limit.label,
                            stroke: token(
                                limit.tone === 'warn'
                                    ? '--status-warn'
                                    : '--status-error',
                            ),
                            width: 1,
                            dash: [6, 4],
                        })),
                        ...config.limits
                            .filter((limit) => limit.highlight === true)
                            .flatMap((limit) =>
                                config.series.map(([, label]) => ({
                                    label: `${label} > ${limit.label}`,
                                    stroke: token(
                                        limit.tone === 'warn'
                                            ? '--status-warn'
                                            : '--status-error',
                                    ),
                                    width: 3,
                                })),
                            ),
                    ],
                },
                dataRef.current,
                element,
            );
        };

        build();

        // Redimensionar no próximo quadro: fazê-lo dentro do callback dispara o erro
        // "ResizeObserver loop completed with undelivered notifications".
        let frame = 0;
        const resize = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                plotRef.current?.setSize({
                    width: element.clientWidth,
                    height: element.clientHeight,
                });
            });
        });
        resize.observe(element);

        const themeWatcher = new MutationObserver(build);
        themeWatcher.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });

        return () => {
            cancelAnimationFrame(frame);
            resize.disconnect();
            themeWatcher.disconnect();
            plotRef.current?.destroy();
            plotRef.current = undefined;
        };
    }, [xLabel, yLabel, layout]);

    const moveTo = (index: number) => {
        const plot = plotRef.current;
        const frequency = frequencies[index];

        if (plot === undefined || frequency === undefined) {
            return;
        }

        plot.setCursor({
            left: plot.valToPos(frequency, 'x'),
            top: plot.over.clientHeight / 2,
        });
        setAnnounce(true);
    };

    const point =
        cursor === null || series.length === 0
            ? undefined
            : {
                  frequency: frequencies[cursor.index],
                  values: series.map((item) => {
                      const peak = peakOf(frequencies, item.values, xRange);

                      return {
                          id: item.id,
                          label: item.label,
                          color: item.color,
                          dashed: item.dashed === true,
                          emphasis: item.emphasis,
                          value: item.values[cursor.index] ?? null,
                          peak:
                              peak === undefined
                                  ? undefined
                                  : {
                                        value: peak.value,
                                        frequency: frequencies[peak.index],
                                    },
                      };
                  }),
              };
    const reading =
        point === undefined || point.frequency === undefined
            ? ''
            : `${formatFrequency(point.frequency)}: ${point.values
                  .map(({ label: name, value }) =>
                      series.length > 1
                          ? `${name} ${value === null ? '—' : formatValue(value)}`
                          : value === null
                            ? '—'
                            : formatValue(value),
                  )
                  .join('; ')}`;

    return (
        <div
            role="group"
            aria-label={label}
            tabIndex={series.length > 0 ? 0 : -1}
            onKeyDown={(event) => {
                const index = nextIndex(
                    event,
                    cursor?.index ?? null,
                    frequencies.length - 1,
                );

                if (index !== null) {
                    event.preventDefault();
                    moveTo(index);
                }
            }}
            onBlur={() => setAnnounce(false)}
            onPointerMove={() => setAnnounce(false)}
            className="relative h-full w-full rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:outline-solid"
        >
            <div ref={container} className="h-full w-full" />
            {point !== undefined &&
                reading !== '' && (
                    // Posição só se conhece em tempo de execução (exceção do uPlot, T064). O balão
                    // fica ao lado do cursor, no lado com mais espaço, para não cobrir a curva.
                    <div
                        aria-hidden="true"
                        data-testid="chart-tooltip"
                        className="pointer-events-none absolute top-2 z-10 flex min-w-36 flex-col gap-1.5 rounded-md border border-border bg-surface px-2.5 py-2 text-xs whitespace-nowrap shadow-md"
                        style={
                            (cursor?.left ?? 0) >
                            (container.current?.clientWidth ?? 0) / 2
                                ? {
                                      right:
                                          (container.current?.clientWidth ??
                                              0) -
                                          (cursor?.left ?? 0) +
                                          12,
                                  }
                                : { left: (cursor?.left ?? 0) + 12 }
                        }
                    >
                        <div className="num font-semibold">
                            {formatFrequency(point.frequency)}
                        </div>
                        {point.values.map(
                            ({
                                id,
                                label: name,
                                value,
                                color,
                                dashed,
                                emphasis,
                                peak,
                            }) => (
                                <div key={id} className="flex flex-col">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="flex min-w-0 items-center gap-1.5">
                                            <span
                                                aria-hidden="true"
                                                className={cn(
                                                    'w-3 shrink-0',
                                                    dashed
                                                        ? cn(
                                                              'border-t-2 border-dashed',
                                                              RING_SWATCH[
                                                                  color
                                                              ],
                                                          )
                                                        : cn(
                                                              'h-0.5 rounded-full',
                                                              SWATCH[color],
                                                          ),
                                                )}
                                            />
                                            <span
                                                className={cn(
                                                    'truncate',
                                                    emphasis
                                                        ? 'font-semibold'
                                                        : 'text-muted',
                                                )}
                                            >
                                                {name}
                                            </span>
                                        </span>
                                        <span className="num font-semibold">
                                            {value === null
                                                ? '—'
                                                : formatValue(value)}
                                        </span>
                                    </div>
                                    {peak !== undefined && (
                                        <div className="pl-[18px] num text-[11px] text-muted">
                                            {peakLabel}{' '}
                                            {formatValue(peak.value)} ·{' '}
                                            {formatFrequency(peak.frequency)}
                                        </div>
                                    )}
                                </div>
                            ),
                        )}
                    </div>
                )}
            <p aria-live="polite" className="sr-only">
                {announce ? reading : ''}
            </p>
        </div>
    );
}
