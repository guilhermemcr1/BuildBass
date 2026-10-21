import type {
    BoxType,
    PortInput,
    ProjectInput,
    SimulationResults,
} from '@/engine';
import { validateResolved } from './config';
import { layoutRow } from './layout';
import type { LayoutItem } from './layout';
import type {
    CutPlan,
    Cutout,
    Dimensions,
    Piece,
    PlanKey,
    ResolvedCutPlanConfig,
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
    const keys: PlanKey[] =
        box.type === 'bandpass' ? ['vr_m3', 'vf_m3'] : ['vb_m3'];
    const values = keys.map((key) => box[key as 'vb_m3' | 'vr_m3' | 'vf_m3']);
    const missing = keys.filter((_key, index) => values[index] === undefined);
    const invalid = keys.filter(
        (_key, index) =>
            values[index] !== undefined && !positive(values[index]),
    );

    if (missing.length > 0 || invalid.length > 0) {
        return { missing, invalid };
    }

    if (box.type === 'bandpass') {
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
    project: ProjectInput,
): { kind: Cutout['kind']; measure: PortMeasure }[] {
    return portCutouts(project.box.port).map((measure) => ({
        kind: 'port' as const,
        measure,
    }));
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

    const frontMeasures = bandpass
        ? portMeasures(project)
        : [
              ...driverMeasures(project, config),
              ...(boxType === 'vented' ? portMeasures(project) : []),
          ];
    const front = placeCutouts(frontPanel, frontMeasures, t);
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
        piece('back', external.w_m, external.h_m),
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

    return {
        status: 'ready',
        plan: {
            boxType,
            thickness_m: t,
            dimensions,
            pieces,
            ...(portLength === undefined ? {} : { port_length_m: portLength }),
            volume: { chambers: [] },
            warnings: [],
        },
    };
}
