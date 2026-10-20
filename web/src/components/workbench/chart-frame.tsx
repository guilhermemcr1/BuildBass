import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export type ChartSeries = {
    id: string;
    label: string;
    slot: 1 | 2 | 3;
    // Projeto ativo: linha mais grossa.
    emphasis: boolean;
    // Já na unidade exibida; null = sem valor nesse ponto.
    values: (number | null)[];
};

export type ChartLimit = {
    value: number;
    tone: 'warn' | 'error';
    label: string;
};

type ChartFrameProps = {
    xLabel: string;
    yLabel: string;
    frequencies: readonly number[];
    series: ChartSeries[];
    limits?: ChartLimit[];
    // Faixa fixa do eixo y; sem ela, o uPlot ajusta aos dados.
    yRange?: [number, number];
    yIncrs?: number[];
};

type Layout = {
    series: [string, string, number, boolean][];
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
    ];
}

// Gráfico com eixo de frequência logarítmico. As cores vêm dos tokens do tema (lidas em tempo
// de execução) e o gráfico é refeito quando o tema ou a composição das séries muda; mudanças só
// de valores usam setData.
export default function ChartFrame({
    xLabel,
    yLabel,
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

    const layout = JSON.stringify({
        series: series.map(({ id, label, slot, emphasis }) => [
            id,
            label,
            slot,
            emphasis,
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
                    cursor: { show: false },
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
                        ...config.series.map(([, label, slot, emphasis]) => ({
                            label,
                            stroke: token(`--series-${slot}`),
                            width: emphasis ? 2.5 : 1.5,
                        })),
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

    return <div ref={container} className="h-full w-full" />;
}
