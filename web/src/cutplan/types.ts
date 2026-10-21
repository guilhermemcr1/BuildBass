import type { BoxType, FieldKey } from '@/engine';

// Tipos do plano de corte (specs/005, data-model.md). Tudo em SI.

export type CutPlanProportion =
    | 'golden'
    | 'louden'
    | 'equalSteps'
    | 'cube'
    | 'custom';

export type Ratio = { h: number; w: number; d: number };

// O que o usuário alterou; o resto vem dos padrões em `resolveCutPlan`.
export type CutPlanConfig = {
    thickness_m?: number;
    proportion?: CutPlanProportion;
    custom?: Ratio;
    braces_m3?: number;
    cutout_m?: number;
};

export type ResolvedCutPlanConfig = {
    thickness_m: number;
    proportion: CutPlanProportion;
    ratio: Ratio;
    braces_m3: number;
    cutout_m?: number;
};

export type PlanKey =
    | FieldKey
    | 'thickness_m'
    | 'ratio'
    | 'braces_m3'
    | 'cutout_m';

export type PieceRole =
    | 'front'
    | 'back'
    | 'top'
    | 'bottom'
    | 'side'
    | 'divider';

export type Cutout = {
    kind: 'driver' | 'port';
    shape: 'round' | 'rect' | 'triangle';
    // round
    diameter_m?: number;
    // rect
    width_m?: number;
    // rect e triangle
    height_m?: number;
    // triangle
    base_m?: number;
    // Origem no canto inferior esquerdo da peça.
    center?: { x_m: number; y_m: number };
    // O que falta para medir ou posicionar.
    pending?: PlanKey[];
};

export type Piece = {
    role: PieceRole;
    quantity: number;
    // Plano da peça: eixo horizontal e vertical do desenho.
    w_m: number;
    h_m: number;
    thickness_m: number;
    cutouts: Cutout[];
};

export type Dimensions = {
    internal: { w_m: number; h_m: number; d_m: number };
    external: { w_m: number; h_m: number; d_m: number };
    // Bandpass: profundidade interna de cada câmara (rear + front = internal.d_m).
    chambers?: { rear_d_m: number; front_d_m: number };
};

export type ChamberCheck = {
    id: 'main' | 'rear' | 'front';
    internal_m3: number;
    braces_m3: number;
    drivers_m3: number;
    ports_m3: number;
    net_m3: number;
    simulated_m3?: number;
    // |líquido − simulado| / simulado
    difference_ratio?: number;
};

export type VolumeCheck = {
    chambers: ChamberCheck[];
    // Ausente quando a simulação não tem o volume líquido.
    matchesSimulation?: boolean;
};

export type PlanWarningId =
    | 'cutoutTooBig'
    | 'cutoutsDoNotFit'
    | 'cutoutTight'
    | 'portLongerThanDepth'
    | 'driverCutoutUnknown'
    | 'portUnknown'
    | 'simulationUnavailable'
    | 'volumeMismatch';

export type PlanWarning = {
    id: PlanWarningId;
    tone: 'info' | 'warn' | 'error';
    piece?: PieceRole;
    key?: PlanKey;
};

export type Plan = {
    boxType: BoxType;
    thickness_m: number;
    dimensions: Dimensions;
    pieces: Piece[];
    volume: VolumeCheck;
    warnings: PlanWarning[];
};

export type CutPlan =
    | { status: 'blocked'; missing: PlanKey[]; invalid: PlanKey[] }
    | { status: 'ready'; plan: Plan };
