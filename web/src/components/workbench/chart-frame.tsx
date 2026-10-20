import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

type ChartFrameProps = {
    xLabel: string;
    yLabel: string;
};

const FREQUENCY_RANGE: [number, number] = [10, 1000];
const LEVEL_RANGE: [number, number] = [-36, 6];

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

// Quadro do gráfico com eixo de frequência logarítmico. As cores vêm dos tokens do tema
// (lidas em tempo de execução) e o gráfico é refeito quando o tema muda. Nesta feature não há
// curvas: o motor de cálculo chega na feature 002.
export default function ChartFrame({ xLabel, yLabel }: ChartFrameProps) {
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = container.current;

        if (element === null) {
            return;
        }

        let plot: uPlot | undefined;

        const build = () => {
            plot?.destroy();

            const grid = { stroke: token('--border'), width: 1 };
            const axis = {
                stroke: token('--muted'),
                grid,
                ticks: grid,
                font: '11px "IBM Plex Mono", monospace',
                labelFont: '12px "Archivo Variable", sans-serif',
            };

            plot = new uPlot(
                {
                    width: element.clientWidth,
                    height: element.clientHeight,
                    legend: { show: false },
                    cursor: { show: false },
                    scales: {
                        x: { time: false, distr: 3, range: FREQUENCY_RANGE },
                        y: { range: LEVEL_RANGE },
                    },
                    axes: [
                        {
                            ...axis,
                            label: xLabel,
                            values: (_plot, ticks) => ticks.map(frequencyTick),
                        },
                        { ...axis, label: yLabel, incrs: [3, 6, 12] },
                    ],
                    series: [{}],
                },
                [[...FREQUENCY_RANGE]],
                element,
            );
        };

        build();

        const resize = new ResizeObserver(() => {
            plot?.setSize({
                width: element.clientWidth,
                height: element.clientHeight,
            });
        });
        resize.observe(element);

        const themeWatcher = new MutationObserver(build);
        themeWatcher.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme'],
        });

        return () => {
            resize.disconnect();
            themeWatcher.disconnect();
            plot?.destroy();
        };
    }, [xLabel, yLabel]);

    return <div ref={container} className="h-full w-full" />;
}
