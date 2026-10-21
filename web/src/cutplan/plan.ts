import type {
    BoxType,
    PortInput,
    ProjectInput,
    SimulationResults,
} from '@/engine';
import { portArea, twoChambers } from '@/engine';
import { validateResolved } from './config';
import { layoutRow } from './layout';
import type { LayoutItem } from './layout';
import type {
    CutPlan,
    ChamberCheck,
    Cutout,
    Dimensions,
    Piece,
    PlanKey,
    PlanWarning,
    ResolvedCutPlanConfig,
    VolumeCheck,
} from './types';

// Plano de corte (specs/005, research.md §1 e §2): geometria de marcenaria sobre o volume bruto do
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

type PortMeasure = LayoutItem & { shape: Cutout['shape']; pending: PlanKey[] };

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

    return Array.from({ length: count }, () => ({
        ...one,
        pending: [...one.pending],
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
        case 'triangle':
            if (measure.w_m !== undefined) {
                cutout.base_m = measure.w_m;
            }
            if (measure.h_m !== undefined) {
                cutout.height_m = measure.h_m;
            }
            break;
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
};

// Posiciona os recortes de uma peça em fila única (drivers antes dos dutos).
export function placeCutouts(
    panel: { w_m: number; h_m: number },
    measures: { kind: Cutout['kind']; measure: PortMeasure }[],
    web_m: number,
): PlacedCutouts {
    const layout = layoutRow(
        panel,
        measures.map(({ measure }) => measure),
        web_m,
    );

    return {
        cutouts: measures.map(({ kind, measure }, index) =>
            cutoutOf(kind, measure, layout.centers[index]),
        ),
        doNotFit: layout.doNotFit,
        tight: layout.tight,
        tooBig: layout.tooBig,
    };
}

function driverMeasures(
    project: ProjectInput,
    config: ResolvedCutPlanConfig,
): { kind: Cutout['kind']; measure: PortMeasure }[] {
    const count = Math.max(0, Math.round(project.drivers.count));
    const diameter = config.cutout_m;

    return Array.from({ length: count }, () => ({
        kind: 'driver' as const,
        measure: {
            shape: 'round' as const,
            w_m: diameter,
            h_m: diameter,
            pending: diameter === undefined ? (['cutout_m'] as PlanKey[]) : [],
        },
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

// Diferença acima disso é erro de álgebra, não de arredondamento (research.md §1).
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

    // Bandpass de 6ª ordem: cada câmara tem o seu duto; o traseiro sai pelo fundo (specs/007).
    const sixth = boxType === 'bandpass6';
    const rearPort: PortInput = project.box.port_rear ?? {
        shape: 'round',
        count: 1,
    };
    const frontMeasures = bandpass
        ? portMeasures(project.box.port)
        : [
              ...driverMeasures(project, config),
              ...(boxType === 'vented' ? portMeasures(project.box.port) : []),
          ];
    const front = placeCutouts(frontPanel, frontMeasures, t);
    const back = sixth
        ? placeCutouts(frontPanel, portMeasures(rearPort), t)
        : undefined;
    const divider = bandpass
        ? placeCutouts(dividerPanel, driverMeasures(project, config), t)
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
    ];

    const portLength = results.port_length_m;
    const rearLength = results.port_rear_length_m;
    const ported = boxType !== 'closed';
    // O mesmo volume de duto que o motor descontou (research.md §1); sem área ou comprimento a
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
