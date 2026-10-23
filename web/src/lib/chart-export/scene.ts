import { frequencySplits, frequencyTick, peakOf, yTicks } from './axes';
import { effectiveGroups, legendBlocks } from './legend';
import type { LegendBlock } from './legend';
import { PAPER, SERIES_PAPER } from './palette';
import { toWinAnsi, wrap } from './text';
import { SCENE_HEIGHT, SCENE_WIDTH } from './types';
import type {
    ExportInput,
    ExportSeries,
    LegendGroups,
    Primitive,
    Scene,
} from './types';

const MARGIN = 32;
const LEGEND_WIDTH = 252;
const PLOT = {
    left: 92,
    top: 84,
    right: SCENE_WIDTH - MARGIN - LEGEND_WIDTH - 16,
    bottom: SCENE_HEIGHT - 82,
};
const LEGEND_LEFT = SCENE_WIDTH - MARGIN - LEGEND_WIDTH;
const LEGEND_BOTTOM = SCENE_HEIGHT - MARGIN;
const DASH: number[] = [6, 4];
const LINE_GAP = 1.35;
const BLOCK_GAP = 12;
const SWATCH_WIDTH = 22;
const TEXT_INDENT = SWATCH_WIDTH + 8;

// Tamanhos da legenda, do mais confortável ao mais compacto (research §8).
const LEGEND_SIZES = [
    { head: 11, detail: 10 },
    { head: 9.5, detail: 8.5 },
];

const NONNEGATIVE: ExportInput['kind'][] = ['excursion', 'portVelocity'];

const round = (value: number) => Number(value.toFixed(2));

function visible(input: ExportInput, item: ExportSeries): (number | null)[] {
    const [min, max] = input.xRange;

    return item.values.map((value, index) => {
        const frequency = input.frequencies[index];

        return frequency >= min && frequency <= max ? value : null;
    });
}

function yScale(
    input: ExportInput,
    limitValues: number[],
): { range: [number, number]; ticks: number[] } {
    if (input.yRange !== undefined) {
        return {
            range: input.yRange,
            ticks: yTicks(input.yRange[0], input.yRange[1], input.yIncrs),
        };
    }

    const values = [
        ...input.series.flatMap((item) =>
            visible(input, item).filter((value) => value !== null),
        ),
        ...limitValues,
    ];

    if (values.length === 0) {
        return { range: [0, 1], ticks: yTicks(0, 1) };
    }

    const low = Math.min(...values);
    const high = Math.max(...values);
    const pad = (high - low || Math.abs(high) || 1) * 0.08;
    const rawLow = NONNEGATIVE.includes(input.kind) ? 0 : low - pad;
    const rawTicks = yTicks(rawLow, high + pad, input.yIncrs);
    const step = rawTicks.length > 1 ? rawTicks[1] - rawTicks[0] : 1;
    const range: [number, number] = [
        Math.floor(rawLow / step) * step,
        Math.ceil((high + pad) / step) * step,
    ];

    return { range, ticks: yTicks(range[0], range[1], input.yIncrs) };
}

// Trechos contínuos de uma série (o valor nulo quebra a linha), em coordenadas da cena. Pontos
// fora da faixa y ficam presos à borda do quadro.
function segments(
    input: ExportInput,
    values: (number | null)[],
    toX: (hz: number) => number,
    toY: (value: number) => number,
    keep: (value: number) => boolean = () => true,
): [number, number][][] {
    const result: [number, number][][] = [];
    let current: [number, number][] = [];

    const close = () => {
        if (current.length > 1) {
            result.push(current);
        }

        current = [];
    };

    values.forEach((value, index) => {
        if (value === null || !keep(value)) {
            close();

            return;
        }

        current.push([
            round(toX(input.frequencies[index])),
            round(Math.min(PLOT.bottom, Math.max(PLOT.top, toY(value)))),
        ]);
    });
    close();

    return result;
}

type LegendPlacement = { items: Primitive[]; height: number; shown: number };

function placeLegend(
    input: ExportInput,
    blocks: LegendBlock[],
    sizes: { head: number; detail: number },
    count: number,
): LegendPlacement {
    const items: Primitive[] = [];
    const width = LEGEND_WIDTH - TEXT_INDENT;
    let y = PLOT.top;

    blocks.slice(0, count).forEach((block) => {
        block.rows.forEach((row) => {
            if (row.type === 'series') {
                const lines = wrap(
                    toWinAnsi(row.text),
                    sizes.head,
                    row.bold,
                    width,
                );
                const base = y + sizes.head;

                items.push({
                    type: 'line',
                    x1: LEGEND_LEFT,
                    y1: round(base - sizes.head * 0.32),
                    x2: LEGEND_LEFT + SWATCH_WIDTH,
                    y2: round(base - sizes.head * 0.32),
                    stroke: SERIES_PAPER[row.color],
                    width: 2.5,
                    dash: row.dashed ? DASH : undefined,
                });
                lines.forEach((line, index) => {
                    items.push({
                        type: 'text',
                        x: LEGEND_LEFT + TEXT_INDENT,
                        y: round(base + index * sizes.head * LINE_GAP),
                        text: line,
                        size: sizes.head,
                        bold: row.bold,
                        color: PAPER.text,
                        anchor: 'start',
                    });
                });
                y += Math.max(1, lines.length) * sizes.head * LINE_GAP;

                return;
            }

            wrap(toWinAnsi(row.text), sizes.detail, false, width).forEach(
                (line) => {
                    items.push({
                        type: 'text',
                        x: LEGEND_LEFT + TEXT_INDENT,
                        y: round(y + sizes.detail),
                        text: line,
                        size: sizes.detail,
                        color:
                            row.tone === undefined
                                ? PAPER.muted
                                : PAPER[row.tone],
                        anchor: 'start',
                    });
                    y += sizes.detail * LINE_GAP;
                },
            );
        });
        y += BLOCK_GAP;
    });

    if (count < blocks.length) {
        items.push({
            type: 'text',
            x: LEGEND_LEFT,
            y: round(y + sizes.detail),
            text: toWinAnsi(input.labels.more(blocks.length - count)),
            size: sizes.detail,
            color: PAPER.muted,
            anchor: 'start',
        });
        y += sizes.detail * LINE_GAP;
    }

    return { items, height: y - PLOT.top, shown: count };
}

// Coluna de legenda: tamanho normal, depois compacto; se ainda não couber, mostra os primeiros
// projetos e termina com "+N projetos" em vez de cortar no meio de uma linha.
function legendItems(input: ExportInput, blocks: LegendBlock[]): Primitive[] {
    const room = LEGEND_BOTTOM - PLOT.top;

    for (const sizes of LEGEND_SIZES) {
        const placed = placeLegend(input, blocks, sizes, blocks.length);

        if (placed.height <= room) {
            return placed.items;
        }
    }

    const sizes = LEGEND_SIZES[LEGEND_SIZES.length - 1];

    for (let count = blocks.length - 1; count > 0; count--) {
        const placed = placeLegend(input, blocks, sizes, count);

        if (placed.height <= room) {
            return placed.items;
        }
    }

    return placeLegend(input, blocks, sizes, 1).items;
}

// Monta a imagem do gráfico como uma lista de primitivas (specs/011, research §1): a mesma cena
// vira SVG, PNG e PDF. Pura e determinística; a data vem em `input`.
export function buildScene(input: ExportInput, groups: LegendGroups): Scene {
    const effective = effectiveGroups(groups, input.kind, input.limits);
    const items: Primitive[] = [];
    const text = (
        value: string,
        x: number,
        y: number,
        size: number,
        anchor: 'start' | 'middle' | 'end',
        options: { bold?: boolean; color?: string; rotate?: number } = {},
    ) =>
        items.push({
            type: 'text',
            x: round(x),
            y: round(y),
            text: toWinAnsi(value),
            size,
            bold: options.bold,
            color: options.color ?? PAPER.text,
            anchor,
            rotate: options.rotate,
        });

    items.push({
        type: 'rect',
        x: 0,
        y: 0,
        w: SCENE_WIDTH,
        h: SCENE_HEIGHT,
        fill: PAPER.background,
    });

    const [minHz, maxHz] = input.xRange;
    const logSpan = Math.log(maxHz) - Math.log(minHz);
    const toX = (hz: number) =>
        PLOT.left +
        ((Math.log(hz) - Math.log(minHz)) / logSpan) * (PLOT.right - PLOT.left);
    const limitValues = effective.limits
        ? input.limits.map((limit) => limit.value)
        : [];
    const { range, ticks } = yScale(input, limitValues);
    const toY = (value: number) =>
        PLOT.bottom -
        ((value - range[0]) / (range[1] - range[0])) * (PLOT.bottom - PLOT.top);

    // Cabeçalho.
    text(input.title, MARGIN, 52, 20, 'start', { bold: true });
    text(
        new Intl.DateTimeFormat(input.locale, { dateStyle: 'medium' }).format(
            input.date,
        ),
        SCENE_WIDTH - MARGIN,
        52,
        11,
        'end',
        { color: PAPER.muted },
    );

    // Grade e rótulos do eixo y.
    const number = new Intl.NumberFormat(input.locale, {
        maximumFractionDigits: 2,
    });

    ticks.forEach((tick) => {
        const y = toY(tick);

        items.push({
            type: 'line',
            x1: PLOT.left,
            y1: round(y),
            x2: PLOT.right,
            y2: round(y),
            stroke: PAPER.grid,
            width: 0.75,
        });
        text(number.format(tick), PLOT.left - 8, y + 3.5, 10, 'end', {
            color: PAPER.muted,
        });
    });

    // Grade e rótulos do eixo x (logarítmico).
    const narrow = maxHz / minHz < 6;

    frequencySplits(minHz, maxHz).forEach((tick) => {
        const x = toX(tick);
        const label = frequencyTick(tick, narrow);

        items.push({
            type: 'line',
            x1: round(x),
            y1: PLOT.top,
            x2: round(x),
            y2: PLOT.bottom,
            stroke: PAPER.grid,
            width: label === '' ? 0.4 : 0.75,
        });

        if (label !== '') {
            text(label, x, PLOT.bottom + 16, 10, 'middle', {
                color: PAPER.muted,
            });
        }
    });

    items.push({
        type: 'rect',
        x: PLOT.left,
        y: PLOT.top,
        w: PLOT.right - PLOT.left,
        h: PLOT.bottom - PLOT.top,
        stroke: PAPER.muted,
    });
    text(
        input.xLabel,
        (PLOT.left + PLOT.right) / 2,
        PLOT.bottom + 38,
        11,
        'middle',
    );
    text(input.yLabel, MARGIN + 6, (PLOT.top + PLOT.bottom) / 2, 11, 'middle', {
        rotate: -90,
    });

    // Limites (por baixo das curvas).
    if (effective.limits) {
        input.limits.forEach((limit) => {
            const y = toY(limit.value);

            if (limit.value < range[0] || limit.value > range[1]) {
                return;
            }

            items.push({
                type: 'line',
                x1: PLOT.left,
                y1: round(y),
                x2: PLOT.right,
                y2: round(y),
                stroke: PAPER[limit.tone],
                width: 1.25,
                dash: DASH,
            });
            text(limit.label, PLOT.right - 6, y - 5, 9.5, 'end', {
                color: PAPER[limit.tone],
            });
        });
    }

    // Curvas.
    input.series.forEach((item) => {
        const stroke = SERIES_PAPER[item.color];

        segments(input, visible(input, item), toX, toY).forEach((points) =>
            items.push({
                type: 'polyline',
                points,
                stroke,
                width: item.emphasis ? 2.75 : 2,
                dash: item.dashed === true ? DASH : undefined,
            }),
        );

        if (!effective.limits) {
            return;
        }

        input.limits
            .filter((limit) => limit.highlight === true)
            .forEach((limit) =>
                segments(
                    input,
                    visible(input, item),
                    toX,
                    toY,
                    (value) => value > limit.value,
                ).forEach((points) =>
                    items.push({
                        type: 'polyline',
                        points,
                        stroke: PAPER[limit.tone],
                        width: 3.5,
                    }),
                ),
            );
    });

    // Marcador do pico de cada série.
    if (effective.peak) {
        input.series.forEach((item) => {
            const peak = peakOf(input.frequencies, item.values, input.xRange);

            if (peak === undefined) {
                return;
            }

            items.push({
                type: 'circle',
                cx: round(toX(input.frequencies[peak.index])),
                cy: round(
                    Math.min(PLOT.bottom, Math.max(PLOT.top, toY(peak.value))),
                ),
                r: 4.5,
                fill: SERIES_PAPER[item.color],
                stroke: PAPER.background,
            });
        });
    }

    items.push(...legendItems(input, legendBlocks(input, effective)));

    return { width: SCENE_WIDTH, height: SCENE_HEIGHT, items };
}
