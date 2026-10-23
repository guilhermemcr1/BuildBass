import { ANALYSIS_FREQUENCIES_HZ } from '@/engine';
import type { ExportInput, ExportProject, ExportSeries } from './types';

// Entrada de exportação pronta para os testes do módulo (curva em sino em torno de 60 Hz).
export function bell(peakHz: number, peakDb: number): (number | null)[] {
    return ANALYSIS_FREQUENCIES_HZ.map(
        (frequency) => peakDb - 12 * Math.abs(Math.log2(frequency / peakHz)),
    );
}

export function project(
    id: string,
    overrides: Partial<ExportProject> = {},
): ExportProject {
    return {
        id,
        name: `Projeto ${id}`,
        color: 1,
        seriesIds: [id],
        box: { type: 'Dutada', volume: '52 L', tuning: '36 Hz' },
        driver: 'Fabricante Modelo',
        signal: '500 W',
        bandpass: false,
        cutoffs: { f3_hz: 38, f10_hz: 29 },
        ...overrides,
    };
}

export function series(
    id: string,
    overrides: Partial<ExportSeries> = {},
): ExportSeries {
    return {
        id,
        label: `Projeto ${id}`,
        color: 1,
        emphasis: false,
        values: bell(60, 92.4),
        ...overrides,
    };
}

const number = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

export function makeInput(overrides: Partial<ExportInput> = {}): ExportInput {
    return {
        kind: 'response',
        title: 'Resposta',
        xLabel: 'Frequência (Hz)',
        yLabel: 'Nível (dB)',
        frequencies: ANALYSIS_FREQUENCIES_HZ,
        series: [series('a')],
        limits: [],
        xRange: [10, 1000],
        yRange: [48, 96],
        yIncrs: [3, 6, 12],
        formatValue: (value) => `${number.format(value)} dB`,
        formatFrequency: (hz) =>
            `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(hz)} Hz`,
        projects: [project('a')],
        locale: 'pt-BR',
        date: new Date(2026, 9, 23),
        labels: {
            peak: 'Pico',
            f3: 'F-3',
            f10: 'F-10',
            tuning: 'Fb',
            belowRange: 'abaixo de 10 Hz',
            aboveRange: 'acima de 1 kHz',
            none: '—',
            exceeded: 'ultrapassado',
            within: 'dentro do limite',
            front: 'frontal',
            rear: 'traseiro',
            more: (count) => `+${count} projetos`,
        },
        ...overrides,
    };
}

export const NO_GROUPS = {
    peak: false,
    cutoffs: false,
    box: false,
    limits: false,
};

export const ALL_GROUPS = {
    peak: true,
    cutoffs: true,
    box: true,
    limits: true,
};
