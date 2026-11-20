import type { BoxType, FieldKey } from '@/engine';

// Tipos do plano de corte. Tudo em SI.

export type CutPlanProportion =
    | 'golden'
    | 'louden'
    | 'equalSteps'
    | 'cube'
    | 'custom';

export type Ratio = { h: number; w: number; d: number };

// Item do estoque de chapas. Enquanto só um lado foi digitado o item é rascunho: não
// entra no encaixe nem no arquivo. Quantidade ausente = sem limite.
export type StockItem = {
    w_m?: number;
    h_m?: number;
    quantity?: number;
};

// Serra (guilhotina: todo corte atravessa o retângulo) ou CNC/tupia (encaixe livre, MaxRects).
export type CutMode = 'guillotine' | 'free';

// Chapas que o usuário tem para cortar. A raiz é o 1º item do estoque (os campos
// da 008 continuam onde estavam); `more` guarda do 2º ao 10º.
export type SheetConfig = {
    w_m?: number;
    h_m?: number;
    // Perda de serra por corte; padrão 0,003 m.
    kerf_m?: number;
    // Pode girar as peças em 90°; padrão sim.
    rotate?: boolean;
    quantity?: number;
    more?: StockItem[];
    // Padrão 'guillotine'.
    cut?: CutMode;
};

export type ResolvedStockItem = {
    // Posição na lista completa (rascunhos incluídos), para o rótulo "Chapa 2".
    index: number;
    w_m: number;
    h_m: number;
    quantity?: number;
};

export type ResolvedSheet = {
    // Ao menos um item completo.
    stock: ResolvedStockItem[];
    kerf_m: number;
    rotate: boolean;
    cut: CutMode;
};

// Qual recorte de qual peça: `n` conta a partir de 1 dentro do tipo na peça, para que mudar o número
// de alto-falantes não desloque a posição dos dutos.
export type CutoutPiece = 'front' | 'back' | 'divider';

export type CutoutRef = {
    piece: CutoutPiece;
    kind: 'driver' | 'port';
    n: number;
};

// Centro do recorte medido da borda esquerda e da de baixo da peça vista de frente.
export type CutoutPosition = CutoutRef & { x_m: number; y_m: number };

// O que o usuário alterou; o resto vem dos padrões em `resolveCutPlan`.
export type CutPlanConfig = {
    thickness_m?: number;
    proportion?: CutPlanProportion;
    custom?: Ratio;
    braces_m3?: number;
    cutout_m?: number;
    // Editar uma medida mantém o volume (padrão) ou muda o Vb com a caixa.
    lockVolume?: boolean;
    sheet?: SheetConfig;
    positions?: CutoutPosition[];
};

// O corpo do alto-falante que o plano usa: o formato decide o recorte (redondo ou retangular) e a
// profundidade atrás do painel (G − F) é conferida contra a câmara.
export type DriverBody = {
    shape?: 'round' | 'square' | 'rect';
    // Segundo lado do recorte retangular (D).
    d_m?: number;
    depth_m?: number;
    // Aro (A): apoia na frente por fora; os outros recortes não podem ficar embaixo dele.
    flange_m?: number;
};

export type ResolvedCutPlanConfig = {
    thickness_m: number;
    proportion: CutPlanProportion;
    ratio: Ratio;
    braces_m3: number;
    cutout_m?: number;
    // Só existe com largura e altura informadas.
    sheet?: ResolvedSheet;
    // Centros gravados pelo usuário; ausente quando não há nenhum.
    positions?: CutoutPosition[];
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
    | 'kerf_m'
    | 'sheet_quantity'
    | 'cutpos_x_m'
    | 'cutpos_y_m';

export type PieceRole =
    | 'front'
    | 'back'
    | 'top'
    | 'bottom'
    | 'side'
    | 'divider'
    // Tábua diagonal que fecha o duto triangular de canto.
    | 'portBoard';

// Uma unidade de uma peça (a lateral tem 2) e onde ela foi parar numa chapa.
export type PieceRef = { role: PieceRole; unit: number };

export type Placement = PieceRef & {
    // Canto inferior esquerdo da peça na chapa.
    x_m: number;
    y_m: number;
    // Medidas como colocadas (trocadas quando girada).
    w_m: number;
    h_m: number;
    rotated: boolean;
};

export type CornerId = 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';

export type Cutout = {
    kind: 'driver' | 'port';
    // Identidade do recorte; `manual` quando o centro veio de uma posição gravada.
    ref?: CutoutRef;
    manual?: true;
    shape: 'round' | 'rect' | 'triangle';
    // round
    diameter_m?: number;
    // rect
    width_m?: number;
    // rect e triangle
    height_m?: number;
    // triangle
    base_m?: number;
    // Giro anti-horário do triangular (o retangular girado já troca largura e altura).
    rotation_deg?: 90 | 180 | 270;
    // Triangular montado no canto: triângulo retângulo com o ângulo reto neste canto da caixa e os
    // catetos (base na horizontal, altura na vertical) encostados nas paredes.
    corner?: CornerId;
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
    | 'volumeMismatch'
    | 'cutoutOverlap'
    | 'cutoutInGlueBand'
    | 'cutoutOutside';

export type PlanWarning = {
    id: PlanWarningId;
    tone: 'info' | 'warn' | 'error';
    piece?: PieceRole;
    key?: PlanKey;
    // Bandpass de 6ª ordem: de qual duto é o aviso, com o comprimento e a profundidade da câmara.
    duct?: 'rear' | 'front';
    // Avisos de posição de recorte.
    cutout?: CutoutRef;
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
