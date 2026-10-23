import type { SeriesColor } from '@/lib/project/types';
import { peakOf } from './axes';
import type {
    CutoffFacts,
    ExportInput,
    ExportKind,
    ExportLimit,
    ExportProject,
    ExportSeries,
    LegendGroup,
    LegendGroups,
} from './types';

export type LegendRow =
    | {
          type: 'series';
          color: SeriesColor;
          dashed: boolean;
          text: string;
          bold: boolean;
      }
    // `tone` pinta o texto de aviso/erro; a palavra ("ultrapassado") vai no texto também, para não
    // depender só da cor.
    | { type: 'detail'; text: string; tone?: 'warn' | 'error' };

export type LegendBlock = { id: string; rows: LegendRow[] };

export type Availability =
    | { available: true }
    | { available: false; reasonKey: string };

const AVAILABLE: Availability = { available: true };

// Quais grupos de legenda fazem sentido para o gráfico aberto (specs/011, research §10). A razão é
// uma chave do namespace `workbench`.
export function availableGroups(
    kind: ExportKind,
    limits: ExportLimit[],
): Record<LegendGroup, Availability> {
    return {
        peak: AVAILABLE,
        cutoffs:
            kind === 'response'
                ? AVAILABLE
                : {
                      available: false,
                      reasonKey: 'charts.export.unavailable.cutoffs',
                  },
        box: AVAILABLE,
        limits:
            (kind === 'excursion' || kind === 'portVelocity') &&
            limits.length > 0
                ? AVAILABLE
                : {
                      available: false,
                      reasonKey: 'charts.export.unavailable.limits',
                  },
    };
}

export function effectiveGroups(
    groups: LegendGroups,
    kind: ExportKind,
    limits: ExportLimit[],
): LegendGroups {
    const available = availableGroups(kind, limits);

    return {
        peak: groups.peak && available.peak.available,
        cutoffs: groups.cutoffs && available.cutoffs.available,
        box: groups.box && available.box.available,
        limits: groups.limits && available.limits.available,
    };
}

// Um valor que arredonda para zero não leva sinal ("-0,0 dB" vira "0,0 dB").
function unsignedZero(text: string): string {
    return text.replace(/(^|\s)-(0(?:[.,]0+)?)(?=\s|$)/, '$1$2');
}

function cutoffText(
    input: ExportInput,
    hz: number | undefined,
    below?: boolean,
    above?: boolean,
): string {
    const { labels } = input;

    if (hz !== undefined) {
        return input.formatFrequency(hz);
    }

    if (below === true) {
        return labels.belowRange;
    }

    return above === true ? labels.aboveRange : labels.none;
}

function cutoffRows(
    input: ExportInput,
    cutoffs: CutoffFacts,
    bandpass: boolean,
): LegendRow[] {
    const { labels } = input;
    const text = (value: string): LegendRow => ({
        type: 'detail',
        text: value,
    });

    if (!bandpass) {
        return [
            text(
                `${labels.f3} ${cutoffText(input, cutoffs.f3_hz, cutoffs.f3_below_range)} · ${labels.f10} ${cutoffText(input, cutoffs.f10_hz, cutoffs.f10_below_range)}`,
            ),
        ];
    }

    const edges = (
        low: number | undefined,
        lowBelow: boolean | undefined,
        high: number | undefined,
        highAbove: boolean | undefined,
    ) =>
        `${cutoffText(input, low, lowBelow)} – ${cutoffText(input, high, undefined, highAbove)}`;

    return [
        text(
            `${labels.f3} ${edges(cutoffs.f_low_hz, cutoffs.f_low_below_range, cutoffs.f_high_hz, cutoffs.f_high_above_range)}`,
        ),
        text(
            `${labels.f10} ${edges(cutoffs.f_low10_hz, cutoffs.f_low10_below_range, cutoffs.f_high10_hz, cutoffs.f_high10_above_range)}`,
        ),
    ];
}

// Algum ponto visível da série acima do limite: o mesmo critério do destaque desenhado no gráfico.
function exceeds(input: ExportInput, owned: ExportSeries[], value: number) {
    const [min, max] = input.xRange;

    return owned.some((item) =>
        item.values.some((point, index) => {
            const frequency = input.frequencies[index];

            return (
                point !== null &&
                frequency !== undefined &&
                frequency >= min &&
                frequency <= max &&
                point > value
            );
        }),
    );
}

function blockOf(
    input: ExportInput,
    project: ExportProject,
    groups: LegendGroups,
): LegendBlock {
    const { labels } = input;
    const owned = project.seriesIds.flatMap((id) => {
        const found = input.series.find((item) => item.id === id);

        return found === undefined ? [] : [found];
    });
    const rows: LegendRow[] = [];

    if (owned.length <= 1) {
        rows.push({
            type: 'series',
            color: project.color,
            dashed: owned[0]?.dashed === true,
            text: project.name,
            bold: true,
        });
    } else {
        owned.forEach((item) =>
            rows.push({
                type: 'series',
                color: project.color,
                dashed: item.dashed === true,
                text: item.label,
                bold: true,
            }),
        );
    }

    if (groups.peak) {
        owned.forEach((item, index) => {
            const peak = peakOf(input.frequencies, item.values, input.xRange);
            const prefix =
                owned.length > 1
                    ? `${index === 0 ? labels.front : labels.rear} · `
                    : '';

            rows.push({
                type: 'detail',
                text:
                    peak === undefined
                        ? `${prefix}${labels.peak} ${labels.none}`
                        : `${prefix}${labels.peak} ${unsignedZero(input.formatValue(peak.value))} · ${input.formatFrequency(input.frequencies[peak.index])}`,
            });
        });
    }

    if (groups.cutoffs) {
        rows.push(...cutoffRows(input, project.cutoffs, project.bandpass));
    }

    if (groups.box) {
        const { type, volume, tuning } = project.box;
        const parts = [
            type,
            volume,
            tuning === '' ? '' : `${labels.tuning} ${tuning}`,
        ].filter((part) => part !== '');

        if (parts.length > 0) {
            rows.push({ type: 'detail', text: parts.join(' · ') });
        }

        if (project.driver !== '') {
            rows.push({ type: 'detail', text: project.driver });
        }

        if (project.signal !== '') {
            rows.push({ type: 'detail', text: project.signal });
        }
    }

    if (groups.limits) {
        input.limits.forEach((limit) => {
            const over = exceeds(input, owned, limit.value);

            rows.push({
                type: 'detail',
                text: `${limit.label} · ${over ? labels.exceeded : labels.within}`,
                tone: over ? limit.tone : undefined,
            });
        });
    }

    return { id: project.id, rows };
}

// Um bloco por projeto plotado, com os grupos de legenda ligados e aplicáveis ao gráfico.
export function legendBlocks(
    input: ExportInput,
    groups: LegendGroups,
): LegendBlock[] {
    const effective = effectiveGroups(groups, input.kind, input.limits);

    return input.projects.map((project) => blockOf(input, project, effective));
}
