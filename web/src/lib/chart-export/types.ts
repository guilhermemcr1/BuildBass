import type { SeriesColor } from '@/lib/project/types';

export type ExportFormat = 'png' | 'pdf';

export type LegendGroups = {
    peak: boolean;
    cutoffs: boolean;
    box: boolean;
    limits: boolean;
};

export type LegendGroup = keyof LegendGroups;

export const LEGEND_GROUPS: LegendGroup[] = [
    'peak',
    'cutoffs',
    'box',
    'limits',
];

export type ExportOptions = { format: ExportFormat; groups: LegendGroups };

// Os mesmos cinco gráficos da bancada (`ChartKind`), declarados aqui para o módulo não depender de
// componente.
export type ExportKind =
    | 'response'
    | 'excursion'
    | 'impedance'
    | 'groupDelay'
    | 'portVelocity';

export type ExportSeries = {
    id: string;
    label: string;
    color: SeriesColor;
    emphasis: boolean;
    // Já na unidade exibida; null = sem valor nesse ponto.
    values: (number | null)[];
    dashed?: boolean;
};

export type ExportLimit = {
    value: number;
    tone: 'warn' | 'error';
    label: string;
    // Redesenha em destaque o trecho de cada série acima do limite.
    highlight?: boolean;
};

// Frequências de corte do projeto em Hz (SI), como o motor entrega.
export type CutoffFacts = {
    // Selada e dutada.
    f3_hz?: number;
    f3_below_range?: boolean;
    f10_hz?: number;
    f10_below_range?: boolean;
    // Bandpass: bordas de −3 dB e de −10 dB.
    f_low_hz?: number;
    f_high_hz?: number;
    f_low_below_range?: boolean;
    f_high_above_range?: boolean;
    f_low10_hz?: number;
    f_high10_hz?: number;
    f_low10_below_range?: boolean;
    f_high10_above_range?: boolean;
};

export type ExportProject = {
    id: string;
    name: string;
    color: SeriesColor;
    // Uma série; duas (frontal e traseiro) na bandpass de 6ª ordem no gráfico de velocidade.
    seriesIds: string[];
    // Já formatados na locale e nas unidades da bancada.
    box: { type: string; volume: string; tuning: string };
    driver: string;
    signal: string;
    bandpass: boolean;
    cutoffs: CutoffFacts;
};

// Textos já traduzidos; o módulo não conhece o i18n.
export type ExportLabels = {
    peak: string;
    f3: string;
    f10: string;
    tuning: string;
    belowRange: string;
    aboveRange: string;
    none: string;
    exceeded: string;
    within: string;
    front: string;
    rear: string;
    // "+N projetos" quando a legenda não cabe.
    more: (count: number) => string;
};

export type ExportInput = {
    kind: ExportKind;
    // Nome do gráfico (aba), usado no título.
    title: string;
    xLabel: string;
    yLabel: string;
    frequencies: readonly number[];
    series: ExportSeries[];
    limits: ExportLimit[];
    xRange: [number, number];
    yRange?: [number, number];
    yIncrs?: number[];
    formatValue: (value: number) => string;
    formatFrequency: (hz: number) => string;
    projects: ExportProject[];
    locale: string;
    date: Date;
    labels: ExportLabels;
};

export type Primitive =
    | {
          type: 'rect';
          x: number;
          y: number;
          w: number;
          h: number;
          fill?: string;
          stroke?: string;
      }
    | {
          type: 'line';
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          stroke: string;
          width: number;
          dash?: number[];
      }
    | {
          type: 'polyline';
          points: [number, number][];
          stroke: string;
          width: number;
          dash?: number[];
      }
    | {
          type: 'circle';
          cx: number;
          cy: number;
          r: number;
          fill?: string;
          stroke?: string;
      }
    | {
          type: 'text';
          x: number;
          y: number;
          text: string;
          size: number;
          bold?: boolean;
          color: string;
          anchor: 'start' | 'middle' | 'end';
          rotate?: number;
      };

export type Scene = {
    width: number;
    height: number;
    items: Primitive[];
};

export const SCENE_WIDTH = 1000;
export const SCENE_HEIGHT = 707;
