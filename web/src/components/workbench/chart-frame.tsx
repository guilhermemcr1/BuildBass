import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import uPlot from 'uplot';
import type { SeriesColor } from '@/lib/project/types';
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
};

type Layout = {
    series: [string, string, number, boolean, boolean][];
    limits: ChartLimit[];
    yRange?: [number, number];
    yIncrs?: number[];
};

const FREQUENCY_RANGE: [number, number] = [10, 1000];

function token(name: string): string {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
}

// Num eixo log só 1, 2 e 5 de cada década recebem rótulo; as demais linhas ficam só na grade.
function frequencyTick(value: number | null): string {
    if (value === null) {
        return '';
    }

    const mantissa = Math.round(value / 10 ** Math.floor(Math.log10(value)));

    if (![1, 2, 5].includes(mantissa)) {
        return '';
    }

    return value >= 1000 ? `${value / 1000}k` : String(value);
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
}: ChartFrameProps) {
    const container = useRef<HTMLDivElement>(null);
    const plotRef = useRef<uPlot | undefined>(undefined);
    const data = chartData(frequencies, series, limits);
    const dataRef = useRef(data);
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
                        drag: { x: false, y: false },
                        points: { size: 7 },
                    },
                    hooks: {
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
                        x: { time: false, distr: 3, range: FREQUENCY_RANGE },
                        y:
                            config.yRange === undefined
                                ? {}
                                : { range: config.yRange },
                    },
                    axes: [
                        {
                            ...axis,
                            label: xLabel,
                            values: (_plot, ticks) => ticks.map(frequencyTick),
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
                  values: series.map((item) => ({
                      id: item.id,
                      label: item.label,
                      value: item.values[cursor.index] ?? null,
                  })),
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
                    // Posição só se conhece em tempo de execução (exceção do uPlot, T064).
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute top-2 z-10 -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-sm"
                        style={{ left: cursor?.left }}
                    >
                        <div className="num font-semibold">
                            {formatFrequency(point.frequency)}
                        </div>
                        {point.values.map(({ id, label: name, value }) => (
                            <div key={id}>
                                {series.length > 1 && (
                                    <span className="text-muted">{name} </span>
                                )}
                                <span className="num">
                                    {value === null ? '—' : formatValue(value)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            <p aria-live="polite" className="sr-only">
                {announce ? reading : ''}
            </p>
        </div>
    );
}
