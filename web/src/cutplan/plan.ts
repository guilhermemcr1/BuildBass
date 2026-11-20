import type {
    BoxType,
    PortInput,
    PortPlacement,
    ProjectInput,
    SimulationResults,
} from '@/engine';
import { portArea, twoChambers } from '@/engine';
import { validateResolved } from './config';
import {
    checkCutouts,
    cutoutExtent,
    layoutEdge,
    nearestFree,
    trianglePoints,
} from './layout';
import type { CutoutIssue, EdgeOptions, Footprint } from './layout';
import type { LayoutItem } from './layout';
import type {
    CornerId,
    CutPlan,
    ChamberCheck,
    Cutout,
    CutoutPiece,
    CutoutPosition,
    CutoutRef,
    Dimensions,
    DriverBody,
    Piece,
    PlanKey,
    PlanWarning,
    ResolvedCutPlanConfig,
    VolumeCheck,
} from './types';

// Plano de corte: geometria de marcenaria sobre o volume bruto do
// projeto. O módulo só lê o resultado da simulação; não a altera nem a repete.

function positive(value: number | undefined): value is number {
    return value !== undefined && Number.isFinite(value) && value > 0;
}

type Volumes = { main: number } | { rear: number; front: number };

// Volumes brutos do projeto; `missing` quando não foram informados e `invalid` quando não servem.
function projectVolumes(
    box: ProjectInput['box'],
): { volumes: Volumes } | { missing: PlanKey[]; invalid: PlanKey[] } {
    const keys: PlanKey[] = twoChambers(box.type)
        ? ['vr_m3', 'vf_m3']
        : ['vb_m3'];
    const values = keys.map((key) => box[key as 'vb_m3' | 'vr_m3' | 'vf_m3']);
    const missing = keys.filter((_key, index) => values[index] === undefined);
    const invalid = keys.filter(
        (_key, index) =>
            values[index] !== undefined && !positive(values[index]),
    );

    if (missing.length > 0 || invalid.length > 0) {
        return { missing, invalid };
    }

    if (twoChambers(box.type)) {
        return {
            volumes: { rear: values[0] as number, front: values[1] as number },
        };
    }

    return { volumes: { main: values[0] as number } };
}

type PortMeasure = LayoutItem & {
    shape: Cutout['shape'];
    pending: PlanKey[];
    // Giro do recorte; `w_m`/`h_m` já são a extensão no painel, depois do giro.
    rotation?: Cutout['rotation_deg'];
    // Triangular de canto: o canto da caixa em que este duto encaixa.
    corner?: CornerId;
};

// Ordem em que os dutos de canto ocupam os cantos: os de baixo primeiro.
const CORNERS: CornerId[] = [
    'bottomLeft',
    'bottomRight',
    'topLeft',
    'topRight',
];

// Triangular de canto: é o padrão do triangular e vale até um duto por canto.
export function cornerMount(port: PortInput): boolean {
    return (
        port.shape === 'triangle' &&
        port.mount !== 'free' &&
        Math.round(port.count) <= CORNERS.length
    );
}

function portCutouts(port: PortInput): PortMeasure[] {
    const count = Math.max(0, Math.round(port.count));
    const one = ((): PortMeasure => {
        switch (port.shape) {
            case 'round':
                return {
                    shape: 'round',
                    w_m: port.diameter_m,
                    h_m: port.diameter_m,
                    pending:
                        port.diameter_m === undefined ? ['diameter_m'] : [],
                };
            case 'rect':
                return {
                    shape: 'rect',
                    w_m: port.width_m,
                    h_m: port.height_m,
                    pending: [
                        ...(port.width_m === undefined
                            ? (['width_m'] as PlanKey[])
                            : []),
                        ...(port.height_m === undefined
                            ? (['height_m'] as PlanKey[])
                            : []),
                    ],
                };
            case 'triangle':
                return {
                    shape: 'triangle',
                    w_m: port.base_m,
                    h_m: port.height_m,
                    pending: [
                        ...(port.base_m === undefined
                            ? (['base_m'] as PlanKey[])
                            : []),
                        ...(port.height_m === undefined
                            ? (['height_m'] as PlanKey[])
                            : []),
                    ],
                };
        }
    })();

    const rotation = port.shape === 'round' ? 0 : (port.rotation ?? 0);
    const turned = rotation === 90 || rotation === 270;
    const placed: PortMeasure = turned
        ? { ...one, w_m: one.h_m, h_m: one.w_m }
        : one;

    // Nos cantos, base e altura são os catetos (horizontal e vertical) e não há giro.
    if (cornerMount(port)) {
        return Array.from({ length: count }, (_, index) => ({
            ...one,
            pending: [...one.pending],
            corner: CORNERS[index],
        }));
    }

    // O retangular girado é só largura e altura trocadas; o triangular guarda o giro.
    if (port.shape === 'triangle' && rotation !== 0) {
        placed.rotation = rotation;
    }

    return Array.from({ length: count }, () => ({
        ...placed,
        pending: [...placed.pending],
    }));
}

function cutoutOf(
    kind: Cutout['kind'],
    measure: PortMeasure,
    center: { x_m: number; y_m: number } | undefined,
): Cutout {
    const cutout: Cutout = { kind, shape: measure.shape };

    switch (measure.shape) {
        case 'round':
            if (measure.w_m !== undefined) {
                cutout.diameter_m = measure.w_m;
            }
            break;
        case 'rect':
            if (measure.w_m !== undefined) {
                cutout.width_m = measure.w_m;
            }
            if (measure.h_m !== undefined) {
                cutout.height_m = measure.h_m;
            }
            break;
        case 'triangle': {
            const turned = measure.rotation === 90 || measure.rotation === 270;
            const base = turned ? measure.h_m : measure.w_m;
            const height = turned ? measure.w_m : measure.h_m;

            if (base !== undefined) {
                cutout.base_m = base;
            }
            if (height !== undefined) {
                cutout.height_m = height;
            }
            if (measure.rotation !== undefined) {
                cutout.rotation_deg = measure.rotation;
            }
            if (measure.corner !== undefined) {
                cutout.corner = measure.corner;
            }
            break;
        }
    }

    if (center !== undefined) {
        cutout.center = center;
    }

    if (measure.pending.length > 0) {
        cutout.pending = measure.pending;
    }

    return cutout;
}

export type PlacedCutouts = {
    cutouts: Cutout[];
    doNotFit: boolean;
    tight: boolean;
    tooBig: boolean;
    // Problemas que envolvem um recorte com posição manual.
    issues: CutoutIssue[];
};

const EDGE_OPTIONS: Record<PortPlacement, EdgeOptions> = {
    auto: {},
    bottom: { side: 'bottom' },
    top: { side: 'top' },
    left: { side: 'left' },
    right: { side: 'right' },
    bottomLeft: { side: 'bottom', align: 'start' },
    bottomRight: { side: 'bottom', align: 'end' },
    topLeft: { side: 'top', align: 'start' },
    topRight: { side: 'top', align: 'end' },
};

export const DEFAULT_PLACEMENT: PortPlacement = 'bottomRight';

// Cantos com duto em pé: encostado na lateral, a partir de baixo (ou de cima).
const TALL_EDGE_OPTIONS: Partial<Record<PortPlacement, EdgeOptions>> = {
    bottomLeft: { side: 'left', align: 'start' },
    bottomRight: { side: 'right', align: 'start' },
    topLeft: { side: 'left', align: 'end' },
    topRight: { side: 'right', align: 'end' },
};

// Posiciona os recortes de uma peça (drivers antes dos dutos). Os que têm posição manual gravada e
// medida conhecida usam o centro gravado; os demais seguem a fila única automática, montada só com
// eles. `n` conta dentro do tipo, a partir de 1.
export function placeCutouts(
    panel: { w_m: number; h_m: number },
    measures: { kind: Cutout['kind']; measure: PortMeasure }[],
    web_m: number,
    piece: CutoutPiece = 'front',
    positions: CutoutPosition[] = [],
    portLayout: Pick<PortInput, 'placement'> = {},
): PlacedCutouts {
    const seen = { driver: 0, port: 0 };
    const entries = measures.map(({ kind, measure }) => {
        seen[kind] += 1;
        const ref: CutoutRef = { piece, kind, n: seen[kind] };
        const saved = positions.find(
            (item) =>
                item.piece === piece && item.kind === kind && item.n === ref.n,
        );
        const sized = measure.w_m !== undefined && measure.h_m !== undefined;

        return {
            kind,
            measure,
            ref,
            manual:
                saved !== undefined && sized
                    ? { x_m: saved.x_m, y_m: saved.y_m }
                    : undefined,
        };
    });
    // Dutos de canto: o ângulo reto fica no canto interno da caixa (a uma espessura da borda do
    // painel), com os catetos rentes às paredes. Os alto-falantes seguem a fila, centralizados.
    const cornerCenter = (
        measure: PortMeasure,
    ): { x_m: number; y_m: number } | undefined => {
        if (
            measure.corner === undefined ||
            measure.w_m === undefined ||
            measure.h_m === undefined
        ) {
            return undefined;
        }

        const left = measure.corner.endsWith('Left');
        const bottom = measure.corner.startsWith('bottom');

        return {
            x_m: left
                ? web_m + measure.w_m / 2
                : panel.w_m - web_m - measure.w_m / 2,
            y_m: bottom
                ? web_m + measure.h_m / 2
                : panel.h_m - web_m - measure.h_m / 2,
        };
    };
    const queue = entries.filter(
        ({ manual, measure }) =>
            manual === undefined && measure.corner === undefined,
    );
    // Padrão: canto inferior direito. `auto` (em fila) põe o redondo na fila do alto-falante e os
    // demais numa extremidade.
    const placement = portLayout.placement ?? DEFAULT_PLACEMENT;
    // No canto, duto mais alto que largo (slot em pé) corre pela lateral; senão, pela base/topo.
    const firstPort = queue.find(({ kind }) => kind === 'port')?.measure;
    const tall =
        firstPort?.w_m !== undefined &&
        firstPort.h_m !== undefined &&
        firstPort.h_m > firstPort.w_m;
    const layout = layoutEdge(
        panel,
        queue.map(({ measure }) => measure),
        queue.map(
            ({ kind, measure }) =>
                kind === 'port' &&
                (placement !== 'auto' || measure.shape !== 'round'),
        ),
        web_m,
        (tall ? TALL_EDGE_OPTIONS[placement] : undefined) ??
            EDGE_OPTIONS[placement],
    );
    const cutouts = entries.map((entry) => {
        if (entry.manual !== undefined) {
            return {
                ...cutoutOf(entry.kind, entry.measure, entry.manual),
                ref: entry.ref,
                manual: true as const,
            };
        }

        if (entry.measure.corner !== undefined) {
            return {
                ...cutoutOf(
                    entry.kind,
                    entry.measure,
                    cornerCenter(entry.measure),
                ),
                ref: entry.ref,
            };
        }

        return {
            ...cutoutOf(
                entry.kind,
                entry.measure,
                layout.centers[queue.indexOf(entry)],
            ),
            ref: entry.ref,
        };
    });
    const manual = cutouts.some((cutout) => cutout.manual === true);

    if (manual) {
        avoidManual(
            panel,
            cutouts,
            web_m,
            entries.map(({ measure }) => measure.outer_m),
        );
    }

    // Cateto maior que o vão interno: o duto de canto não cabe.
    const cornerTooBig = entries.some(
        ({ measure }) =>
            measure.corner !== undefined &&
            ((measure.w_m ?? 0) > panel.w_m - 2 * web_m ||
                (measure.h_m ?? 0) > panel.h_m - 2 * web_m),
    );

    return {
        cutouts,
        doNotFit: layout.doNotFit,
        tight: layout.tight,
        tooBig: layout.tooBig || cornerTooBig,
        issues: [
            ...(manual ? checkCutouts(panel, cutouts, web_m) : []),
            ...cornerClashes(cutouts, web_m),
        ],
    };
}

// Recortes automáticos não podem cair em cima dos que têm posição manual (a fila automática é
// montada sem eles). O que encostar num manual vai para o ponto livre mais perto do lugar
// automático, com `web_m` de folga das bordas e dos outros recortes. Sem ponto livre, fica onde
// está e a conferência acusa o choque.
function avoidManual(
    panel: { w_m: number; h_m: number },
    cutouts: Cutout[],
    web_m: number,
    outers: (number | undefined)[],
): void {
    const footprint = (
        cutout: Cutout,
        index: number,
    ): Footprint | undefined => {
        const { w, h } = cutoutExtent(cutout);

        return cutout.center === undefined || w === undefined || h === undefined
            ? undefined
            : {
                  x: cutout.center.x_m,
                  y: cutout.center.y_m,
                  w,
                  h,
                  round: cutout.shape === 'round',
                  ...(outers[index] === undefined
                      ? {}
                      : { outer: outers[index] }),
              };
    };
    const fixed: Footprint[] = cutouts
        .map((cutout, index) =>
            cutout.manual === true ? footprint(cutout, index) : undefined,
        )
        .filter((box): box is Footprint => box !== undefined);

    for (const [index, cutout] of cutouts.entries()) {
        if (cutout.manual === true || cutout.corner !== undefined) {
            continue;
        }

        const box = footprint(cutout, index);

        if (box === undefined) {
            continue;
        }

        const spot = nearestFree(panel, box, fixed, web_m);

        if (spot !== undefined) {
            cutout.center = spot;
            box.x = spot.x_m;
            box.y = spot.y_m;
        }

        fixed.push(box);
    }
}

// Tábuas diagonais dos dutos de canto: uma por duto, com a largura da hipotenusa (face de dentro;
// as bordas são chanfradas no ângulo dos catetos) e o comprimento do duto, limitado ao vão entre a
// frente e o fundo. Sem o comprimento do duto, ainda não há o que cortar.
function cornerBoards(
    cutouts: Cutout[],
    length_m: number | undefined,
    between_m: number,
    thickness_m: number,
): Piece[] {
    const corners = cutouts.filter(
        (cutout) =>
            cutout.corner !== undefined &&
            cutout.base_m !== undefined &&
            cutout.height_m !== undefined,
    );

    if (corners.length === 0 || length_m === undefined || length_m <= 0) {
        return [];
    }

    const first = corners[0]!;

    return [
        {
            role: 'portBoard',
            quantity: corners.length,
            w_m: Math.hypot(first.base_m!, first.height_m!),
            h_m: Math.min(length_m, between_m),
            thickness_m,
            cutouts: [],
        },
    ];
}

// Duto de canto que chega a menos de `web_m` do furo redondo de um alto-falante: medido pelo
// triângulo de verdade (a caixa que o envolve acusaria encostos que não existem).
function cornerClashes(cutouts: Cutout[], web_m: number): CutoutIssue[] {
    const issues: CutoutIssue[] = [];

    for (const port of cutouts) {
        if (
            port.corner === undefined ||
            port.center === undefined ||
            port.ref === undefined ||
            port.base_m === undefined ||
            port.height_m === undefined
        ) {
            continue;
        }

        const points = trianglePoints(
            port.center.x_m,
            port.center.y_m,
            port.base_m,
            port.height_m,
            0,
            port.corner,
        );

        for (const driver of cutouts) {
            if (
                driver.kind !== 'driver' ||
                driver.shape !== 'round' ||
                driver.center === undefined ||
                driver.diameter_m === undefined
            ) {
                continue;
            }

            const { x_m: px, y_m: py } = driver.center;
            const distance = Math.min(
                ...points.map(([ax, ay], index) => {
                    const [bx, by] = points[(index + 1) % points.length]!;
                    const [dx, dy] = [bx - ax, by - ay];
                    const k = Math.max(
                        0,
                        Math.min(
                            1,
                            ((px - ax) * dx + (py - ay) * dy) /
                                (dx * dx + dy * dy),
                        ),
                    );

                    return Math.hypot(px - (ax + k * dx), py - (ay + k * dy));
                }),
            );

            if (distance < driver.diameter_m / 2 + web_m) {
                issues.push({ ref: port.ref, id: 'cutoutOverlap' });
                break;
            }
        }
    }

    return issues;
}

// Recorte do driver: redondo (Ø C), quadrado (C × C) ou retangular (C × D), conforme o formato.
function driverMeasure(config: ResolvedCutPlanConfig, body: DriverBody) {
    const c = config.cutout_m;
    const shape = body.shape ?? 'round';

    if (shape === 'round') {
        return {
            shape: 'round' as const,
            w_m: c,
            h_m: c,
            ...(body.flange_m !== undefined &&
            c !== undefined &&
            body.flange_m > c
                ? { outer_m: body.flange_m }
                : {}),
            pending: c === undefined ? (['cutout_m'] as PlanKey[]) : [],
        };
    }

    const side = shape === 'square' ? c : body.d_m;
    const pending: PlanKey[] = [];

    if (c === undefined) {
        pending.push('cutout_m');
    }

    if (side === undefined && c !== undefined) {
        pending.push('drv_d_m');
    }

    return { shape: 'rect' as const, w_m: c, h_m: side, pending };
}

function driverMeasures(
    project: ProjectInput,
    config: ResolvedCutPlanConfig,
    body: DriverBody,
): { kind: Cutout['kind']; measure: PortMeasure }[] {
    const count = Math.max(0, Math.round(project.drivers.count));

    return Array.from({ length: count }, () => ({
        kind: 'driver' as const,
        measure: driverMeasure(config, body),
    }));
}

function portMeasures(
    port: PortInput,
): { kind: Cutout['kind']; measure: PortMeasure }[] {
    return portCutouts(port).map((measure) => ({
        kind: 'port' as const,
        measure,
    }));
}

// Diferença acima disso é erro de álgebra, não de arredondamento.
const MATCH_TOLERANCE = 1e-9;

type ChamberInput = {
    id: ChamberCheck['id'];
    depth_m: number;
    // Parte dos reforços e do volume do projeto que cabe a esta câmara.
    braces_m3: number;
    drivers_m3: number;
    ports_m3: number;
    simulated_m3: number | undefined;
};

function chamberCheck(
    plan: { w_m: number; h_m: number },
    chamber: ChamberInput,
): ChamberCheck {
    const internal_m3 = plan.w_m * plan.h_m * chamber.depth_m;
    const net_m3 =
        internal_m3 - chamber.braces_m3 - chamber.drivers_m3 - chamber.ports_m3;
    const check: ChamberCheck = {
        id: chamber.id,
        internal_m3,
        braces_m3: chamber.braces_m3,
        drivers_m3: chamber.drivers_m3,
        ports_m3: chamber.ports_m3,
        net_m3,
    };

    if (chamber.simulated_m3 !== undefined && chamber.simulated_m3 > 0) {
        check.simulated_m3 = chamber.simulated_m3;
        check.difference_ratio =
            Math.abs(net_m3 - chamber.simulated_m3) / chamber.simulated_m3;
    }

    return check;
}

function volumeCheck(chambers: ChamberCheck[]): VolumeCheck {
    const compared = chambers.filter(
        ({ difference_ratio }) => difference_ratio !== undefined,
    );

    if (compared.length < chambers.length || chambers.length === 0) {
        return { chambers };
    }

    return {
        chambers,
        matchesSimulation: compared.every(
            ({ difference_ratio }) =>
                (difference_ratio as number) <= MATCH_TOLERANCE,
        ),
    };
}

export function buildCutPlan(
    project: ProjectInput,
    results: SimulationResults,
    config: ResolvedCutPlanConfig,
    body: DriverBody = {},
): CutPlan {
    const found = projectVolumes(project.box);
    const configInvalid = validateResolved(config);

    if ('missing' in found || configInvalid.length > 0) {
        return {
            status: 'blocked',
            missing: 'missing' in found ? found.missing : [],
            invalid: [
                ...('invalid' in found ? found.invalid : []),
                ...configInvalid,
            ],
        };
    }

    const t = config.thickness_m;
    const boxType: BoxType = project.box.type;
    const { volumes } = found;
    const bandpass = 'rear' in volumes;
    const projectTotal = bandpass ? volumes.rear + volumes.front : volumes.main;
    // Reforços repartidos em proporção aos volumes: tudo cresce por (1 + β).
    const growth = 1 + config.braces_m3 / projectTotal;
    const internalVolume = projectTotal * growth;
    const { h: rh, w: rw, d: rd } = config.ratio;
    const k = Math.cbrt(internalVolume / (rh * rw * rd));
    const internal = { w_m: k * rw, h_m: k * rh, d_m: k * rd };
    const area = internal.w_m * internal.h_m;
    const dividerThickness = bandpass ? t : 0;
    const external = {
        w_m: internal.w_m + 2 * t,
        h_m: internal.h_m + 2 * t,
        d_m: internal.d_m + 2 * t + dividerThickness,
    };
    const dimensions: Dimensions = bandpass
        ? {
              internal,
              external,
              chambers: {
                  rear_d_m: (volumes.rear * growth) / area,
                  front_d_m: (volumes.front * growth) / area,
              },
          }
        : { internal, external };

    // Profundidade entre frente e fundo (inclui a espessura da divisória na bandpass).
    const between = external.d_m - 2 * t;
    const frontPanel = { w_m: external.w_m, h_m: external.h_m };
    const dividerPanel = { w_m: internal.w_m, h_m: internal.h_m };

    // Bandpass de 6ª ordem: cada câmara tem o seu duto; o traseiro sai pelo fundo.
    const sixth = boxType === 'bandpass6';
    const rearPort: PortInput = project.box.port_rear ?? {
        shape: 'round',
        count: 1,
    };
    const frontMeasures = bandpass
        ? portMeasures(project.box.port)
        : [
              ...driverMeasures(project, config, body),
              ...(boxType === 'vented' ? portMeasures(project.box.port) : []),
          ];
    const positions = config.positions ?? [];
    const front = placeCutouts(
        frontPanel,
        frontMeasures,
        t,
        'front',
        positions,
        project.box.port,
    );
    const back = sixth
        ? placeCutouts(
              frontPanel,
              portMeasures(rearPort),
              t,
              'back',
              positions,
              rearPort,
          )
        : undefined;
    const divider = bandpass
        ? placeCutouts(
              dividerPanel,
              driverMeasures(project, config, body),
              t,
              'divider',
              positions,
          )
        : undefined;

    const piece = (
        role: Piece['role'],
        w_m: number,
        h_m: number,
        extra: Partial<Piece> = {},
    ): Piece => ({
        role,
        quantity: 1,
        w_m,
        h_m,
        thickness_m: t,
        cutouts: [],
        ...extra,
    });

    const pieces: Piece[] = [
        piece('front', external.w_m, external.h_m, {
            cutouts: front.cutouts,
        }),
        piece('back', external.w_m, external.h_m, {
            cutouts: back?.cutouts ?? [],
        }),
        piece('top', external.w_m, between),
        piece('bottom', external.w_m, between),
        piece('side', between, internal.h_m, { quantity: 2 }),
        ...(divider === undefined
            ? []
            : [
                  piece('divider', internal.w_m, internal.h_m, {
                      cutouts: divider.cutouts,
                  }),
              ]),
        ...cornerBoards(front.cutouts, results.port_length_m, between, t),
    ];

    const portLength = results.port_length_m;
    const rearLength = results.port_rear_length_m;
    const ported = boxType !== 'closed';
    // O mesmo volume de duto que o motor descontou; sem área ou comprimento a
    // conferência não tem como fechar.
    const ductVolume = (
        port: PortInput,
        length: number | undefined,
    ): number | undefined => {
        const area = portArea(port);

        return area !== undefined && length !== undefined
            ? Math.max(1, Math.round(port.count)) * area * length
            : undefined;
    };
    const portsVolume = !ported ? 0 : ductVolume(project.box.port, portLength);
    const rearPortsVolume = sixth ? ductVolume(rearPort, rearLength) : 0;
    const driversVolume =
        Math.max(0, Math.round(project.drivers.count)) *
        (project.driver.vd_m3 ?? 0);
    const share = (volume: number) =>
        (volume / projectTotal) * config.braces_m3;
    const plane = { w_m: internal.w_m, h_m: internal.h_m };

    const chambers: ChamberCheck[] =
        portsVolume === undefined || rearPortsVolume === undefined
            ? []
            : 'rear' in volumes
              ? [
                    chamberCheck(plane, {
                        id: 'rear',
                        depth_m: dimensions.chambers?.rear_d_m ?? 0,
                        braces_m3: share(volumes.rear),
                        drivers_m3: driversVolume,
                        ports_m3: rearPortsVolume,
                        simulated_m3: results.net_rear_m3,
                    }),
                    chamberCheck(plane, {
                        id: 'front',
                        depth_m: dimensions.chambers?.front_d_m ?? 0,
                        braces_m3: share(volumes.front),
                        drivers_m3: 0,
                        ports_m3: portsVolume,
                        simulated_m3: results.net_front_m3,
                    }),
                ]
              : [
                    chamberCheck(plane, {
                        id: 'main',
                        depth_m: internal.d_m,
                        braces_m3: config.braces_m3,
                        drivers_m3: driversVolume,
                        ports_m3: portsVolume,
                        simulated_m3: results.net_volume_m3,
                    }),
                ];
    const volume = volumeCheck(chambers);

    const warnings: PlanWarning[] = [];
    const placed: [Piece['role'], PlacedCutouts | undefined][] = [
        ['front', front],
        ['back', back],
        ['divider', divider],
    ];

    for (const [role, result] of placed) {
        if (result === undefined) {
            continue;
        }

        if (result.tooBig) {
            warnings.push({ id: 'cutoutTooBig', tone: 'error', piece: role });
        }

        if (result.doNotFit) {
            warnings.push({
                id: 'cutoutsDoNotFit',
                tone: 'error',
                piece: role,
            });
        }

        if (result.tight && !result.tooBig && !result.doNotFit) {
            warnings.push({ id: 'cutoutTight', tone: 'warn', piece: role });
        }

        for (const issue of result.issues) {
            warnings.push({
                id: issue.id,
                tone: issue.id === 'cutoutOutside' ? 'error' : 'warn',
                piece: role,
                cutout: issue.ref,
            });
        }
    }

    // O duto da dutada fica na câmara toda; o da bandpass, na câmara frontal; na de 6ª ordem cada
    // duto tem a sua câmara.
    const portDepth = dimensions.chambers?.front_d_m ?? internal.d_m;

    if (sixth) {
        const rearDepth = dimensions.chambers?.rear_d_m ?? internal.d_m;

        for (const [duct, length, depth] of [
            ['rear', rearLength, rearDepth],
            ['front', portLength, portDepth],
        ] as const) {
            if (length !== undefined && length > depth) {
                warnings.push({
                    id: 'portLongerThanDepth',
                    tone: 'warn',
                    duct,
                    length_m: length,
                    depth_m: depth,
                });
            }
        }
    } else if (portLength !== undefined && portLength > portDepth) {
        warnings.push({ id: 'portLongerThanDepth', tone: 'warn' });
    }

    // O driver entra pela frente: o que fica atrás do painel é a profundidade total menos o aro.
    // Na bandpass ele fica na câmara traseira.
    const driverChamber = dimensions.chambers?.rear_d_m ?? internal.d_m;

    if (
        project.drivers.count > 0 &&
        body.depth_m !== undefined &&
        body.depth_m > driverChamber
    ) {
        warnings.push({
            id: 'driverTooDeep',
            tone: 'warn',
            length_m: body.depth_m,
            depth_m: driverChamber,
        });
    }

    if (project.drivers.count > 0 && config.cutout_m === undefined) {
        warnings.push({
            id: 'driverCutoutUnknown',
            tone: 'info',
            key: 'cutout_m',
        });
    }

    if (sixth) {
        for (const [duct, port] of [
            ['rear', rearPort],
            ['front', project.box.port],
        ] as const) {
            if (portArea(port) === undefined) {
                warnings.push({ id: 'portUnknown', tone: 'info', duct });
            }
        }
    } else if (ported && portArea(project.box.port) === undefined) {
        warnings.push({ id: 'portUnknown', tone: 'info' });
    }

    if (volume.matchesSimulation === undefined) {
        warnings.push({ id: 'simulationUnavailable', tone: 'info' });
    } else if (!volume.matchesSimulation) {
        warnings.push({ id: 'volumeMismatch', tone: 'error' });
    }

    return {
        status: 'ready',
        plan: {
            boxType,
            thickness_m: t,
            dimensions,
            pieces,
            ...(portLength === undefined ? {} : { port_length_m: portLength }),
            ...(!sixth || rearLength === undefined
                ? {}
                : { port_rear_length_m: rearLength }),
            volume,
            warnings,
        },
    };
}
