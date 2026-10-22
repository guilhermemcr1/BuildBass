import type { BoxType, FieldKey } from '@/engine';

// Tipos do plano de corte (specs/005, data-model.md). Tudo em SI.

export type CutPlanProportion =
    | 'golden'
    | 'louden'
    | 'equalSteps'
    | 'cube'
    | 'custom';

export type Ratio = { h: number; w: number; d: number };

// Chapa que o usuário tem para cortar (specs/008). Enquanto só um lado foi digitado a chapa
// está incompleta e não entra no encaixe nem no arquivo.
export type SheetConfig = {
    w_m?: number;
    h_m?: number;
    // Perda de serra por corte; padrão 0,003 m.
    kerf_m?: number;
    // Pode girar as peças em 90°; padrão sim.
    rotate?: boolean;
};

export type ResolvedSheet = {
    w_m: number;
    h_m: number;
    kerf_m: number;
    rotate: boolean;
};

// O que o usuário alterou; o resto vem dos padrões em `resolveCutPlan`.
export type CutPlanConfig = {
    thickness_m?: number;
    proportion?: CutPlanProportion;
    custom?: Ratio;
    braces_m3?: number;
    cutout_m?: number;
    sheet?: SheetConfig;
};

// O corpo do alto-falante que o plano usa: o formato decide o recorte (redondo ou retangular) e a
// profundidade atrás do painel (G − F) é conferida contra a câmara.
export type DriverBody = {
    shape?: 'round' | 'square' | 'rect';
    // Segundo lado do recorte retangular (D).
    d_m?: number;
    depth_m?: number;
};

export type ResolvedCutPlanConfig = {
    thickness_m: number;
    proportion: CutPlanProportion;
    ratio: Ratio;
    braces_m3: number;
    cutout_m?: number;
    // Só existe com largura e altura informadas.
    sheet?: ResolvedSheet;
};

export type PlanKey =
    | FieldKey
    | 'thickness_m'
    | 'ratio'
    | 'braces_m3'
    | 'cutout_m'
    | 'drv_d_m'
    | 'sheet_w_m'
    | 'sheet_h_m'
    | 'kerf_m';

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
    | 'driverTooDeep'
    | 'portUnknown'
    | 'simulationUnavailable'
    | 'volumeMismatch';

export type PlanWarning = {
    id: PlanWarningId;
    tone: 'info' | 'warn' | 'error';
    piece?: PieceRole;
    key?: PlanKey;
    // Bandpass de 6ª ordem: de qual duto é o aviso, com o comprimento e a profundidade da câmara.
    duct?: 'rear' | 'front';
    length_m?: number;
    depth_m?: number;
};

export type Plan = {
    boxType: BoxType;
    thickness_m: number;
    dimensions: Dimensions;
    pieces: Piece[];
    // Comprimento do tubo do duto calculado pela simulação (dutada e bandpass).
    port_length_m?: number;
    // Bandpass de 6ª ordem: comprimento do duto da câmara traseira.
    port_rear_length_m?: number;
    volume: VolumeCheck;
    warnings: PlanWarning[];
};

export type CutPlan =
    | { status: 'blocked'; missing: PlanKey[]; invalid: PlanKey[] }
    | { status: 'ready'; plan: Plan };
