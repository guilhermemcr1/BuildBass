import { trianglePoints } from './layout';
import type { Cutout, Piece, PieceRole, Plan } from './types';

// Projeção ortográfica da caixa montada. Função pura: devolve
// polígonos 2D em metros, com a origem no centro da caixa e y para cima, ordenados de trás
// para frente. Quem desenha decide a escala de tela e inverte o eixo y.

export type View = { yaw_rad: number; pitch_rad: number; zoom: number };

export type Polygon = {
    // 'front', 'back', 'top', 'bottom', 'side-1', 'side-2', 'divider', '<peça>:<driver|port>-<n>'
    // ou, nos detalhes, '<peça>:<driver|port>-<n>:<camada>'.
    id: string;
    // `detail`: o que se vê dentro do recorte (aro, cone e capa do alto-falante; paredes do duto).
    kind: 'face' | 'cutout' | 'detail';
    // Só nos detalhes: qual parte do alto-falante ou do duto.
    layer?: 'flange' | 'cone' | 'cap' | 'wall';
    points: [number, number][];
    // Mais perto do observador = maior; os recortes ficam um pouco à frente da própria face.
    depth: number;
    // Só nos recortes: de que peça da caixa é o furo.
    part?: 'driver' | 'port';
    // A face (ou o recorte dela) está virada para o observador; as de trás só aparecem na vista translúcida.
    facing: boolean;
    // Iluminação da face, de 0 (sombra) a 1 (de frente para a luz); quem desenha traduz em tom.
    light: number;
};

// Cota de uma aresta da caixa: linha afastada da aresta, com o ponto do texto no meio.
export type DimensionLine = {
    axis: 'width' | 'height' | 'depth';
    // Medida externa, em metros.
    value_m: number;
    from: [number, number];
    to: [number, number];
    label: [number, number];
    // A aresta medida, para as linhas de chamada que ligam a cota a ela.
    edge: [[number, number], [number, number]];
};

export const DEFAULT_VIEW: View = { yaw_rad: -0.6, pitch_rad: 0.45, zoom: 1 };

type Vec = [number, number, number];

// Rotação por guinada em torno do eixo vertical e depois por inclinação em torno do horizontal.
function rotate([x, y, z]: Vec, yaw: number, pitch: number): Vec {
    const x1 = x * Math.cos(yaw) + z * Math.sin(yaw);
    const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
    const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);

    return [x1, y2, z2];
}

const CIRCLE_POINTS = 24;
const CUTOUT_LIFT_M = 1e-6;
// Alto-falante visto de frente: aro, cone e capa, em fração do tamanho do recorte. O cone e a
// capa ficam afundados atrás do painel (também em fração do tamanho), o que dá a paralaxe ao girar.
const FLANGE_SCALE = 1.2;
const CONE_SCALE = 0.8;
const CONE_RECESS = 0.05;
const CAP_SCALE = 0.28;
const CAP_RECESS = 0.11;
// Normal quase perpendicular ao observador: a face aparece de lado e não é desenhada.
const EDGE_ON = 1e-9;
// Luz vinda de cima, da esquerda e de frente, no referencial do observador (z para ele).
const LIGHT: Vec = [-0.35, 0.75, 0.55];
const LIGHT_NORM = Math.hypot(...LIGHT);

// Eixos do mundo: x largura (esquerda → direita), y altura (baixo → cima), z profundidade (fundo
// → frente). A frente fica em +z e olha para o observador com guinada e inclinação nulas. As
// faces são o invólucro externo (sem a espessura das juntas), para a caixa não ter frestas.
type Face = {
    id: string;
    role: PieceRole;
    normal: Vec;
    // Origem do plano da peça, e os eixos (largura e altura da peça) em coordenadas do mundo.
    origin: Vec;
    right: Vec;
    up: Vec;
    w_m: number;
    h_m: number;
    inner: boolean;
};

function faces(plan: Plan): Face[] {
    const { external: e, internal: i } = plan.dimensions;
    const t = plan.thickness_m;
    const w = e.w_m / 2;
    const h = e.h_m / 2;
    const d = e.d_m / 2;
    const result: Face[] = [
        {
            id: 'front',
            role: 'front',
            normal: [0, 0, 1],
            origin: [-w, -h, d],
            right: [1, 0, 0],
            up: [0, 1, 0],
            w_m: e.w_m,
            h_m: e.h_m,
            inner: false,
        },
        {
            id: 'back',
            role: 'back',
            normal: [0, 0, -1],
            origin: [w, -h, -d],
            right: [-1, 0, 0],
            up: [0, 1, 0],
            w_m: e.w_m,
            h_m: e.h_m,
            inner: false,
        },
        {
            id: 'top',
            role: 'top',
            normal: [0, 1, 0],
            origin: [-w, h, d],
            right: [1, 0, 0],
            up: [0, 0, -1],
            w_m: e.w_m,
            h_m: e.d_m,
            inner: false,
        },
        {
            id: 'bottom',
            role: 'bottom',
            normal: [0, -1, 0],
            origin: [-w, -h, -d],
            right: [1, 0, 0],
            up: [0, 0, 1],
            w_m: e.w_m,
            h_m: e.d_m,
            inner: false,
        },
        {
            id: 'side-1',
            role: 'side',
            normal: [-1, 0, 0],
            origin: [-w, -h, -d],
            right: [0, 0, 1],
            up: [0, 1, 0],
            w_m: e.d_m,
            h_m: e.h_m,
            inner: false,
        },
        {
            id: 'side-2',
            role: 'side',
            normal: [1, 0, 0],
            origin: [w, -h, d],
            right: [0, 0, -1],
            up: [0, 1, 0],
            w_m: e.d_m,
            h_m: e.h_m,
            inner: false,
        },
    ];

    if (plan.dimensions.chambers !== undefined) {
        // A divisória fica a "traseira" de profundidade a partir da face interna do fundo.
        const zFrom = -d + t + plan.dimensions.chambers.rear_d_m;

        result.push({
            id: 'divider',
            role: 'divider',
            normal: [0, 0, 1],
            origin: [-i.w_m / 2, -i.h_m / 2, zFrom + t / 2],
            right: [1, 0, 0],
            up: [0, 1, 0],
            w_m: i.w_m,
            h_m: i.h_m,
            inner: true,
        });
    }

    return result;
}

function onFace(face: Face, x_m: number, y_m: number): Vec {
    return [
        face.origin[0] + face.right[0] * x_m + face.up[0] * y_m,
        face.origin[1] + face.right[1] * x_m + face.up[1] * y_m,
        face.origin[2] + face.right[2] * x_m + face.up[2] * y_m,
    ];
}

// Contorno do recorte no plano da peça (coordenadas da peça, em metros).
function outline(cutout: Cutout): [number, number][] | undefined {
    const { center } = cutout;

    if (center === undefined) {
        return undefined;
    }

    const { x_m: cx, y_m: cy } = center;

    switch (cutout.shape) {
        case 'round': {
            if (cutout.diameter_m === undefined) {
                return undefined;
            }

            const r = cutout.diameter_m / 2;

            return Array.from({ length: CIRCLE_POINTS }, (_, index) => {
                const angle = (2 * Math.PI * index) / CIRCLE_POINTS;

                return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
            });
        }
        case 'rect': {
            if (cutout.width_m === undefined || cutout.height_m === undefined) {
                return undefined;
            }

            const [hw, hh] = [cutout.width_m / 2, cutout.height_m / 2];

            return [
                [cx - hw, cy - hh],
                [cx + hw, cy - hh],
                [cx + hw, cy + hh],
                [cx - hw, cy + hh],
            ];
        }
        case 'triangle': {
            if (cutout.base_m === undefined || cutout.height_m === undefined) {
                return undefined;
            }

            return trianglePoints(
                cx,
                cy,
                cutout.base_m,
                cutout.height_m,
                cutout.rotation_deg,
            );
        }
    }
}

type Point2 = [number, number];

// Contorno escalado em torno do centro do recorte (coordenadas da peça).
function scaled(
    shape: Point2[],
    center: { x_m: number; y_m: number },
    factor: number,
): Point2[] {
    return shape.map(([x, y]) => [
        center.x_m + (x - center.x_m) * factor,
        center.y_m + (y - center.y_m) * factor,
    ]);
}

function circle(
    center: { x_m: number; y_m: number },
    radius: number,
): Point2[] {
    return Array.from({ length: CIRCLE_POINTS }, (_, index) => {
        const angle = (2 * Math.PI * index) / CIRCLE_POINTS;

        return [
            center.x_m + radius * Math.cos(angle),
            center.y_m + radius * Math.sin(angle),
        ];
    });
}

function signedArea(points: Point2[]): number {
    return (
        points.reduce((sum, [x, y], index) => {
            const [nx, ny] = points[(index + 1) % points.length]!;

            return sum + (x * ny - nx * y);
        }, 0) / 2
    );
}

// Recorta um polígono por outro convexo (Sutherland–Hodgman); o duto só aparece dentro do furo.
function clipConvex(subject: Point2[], clip: Point2[]): Point2[] {
    const sign = signedArea(clip) >= 0 ? 1 : -1;
    let output = subject;

    for (let index = 0; index < clip.length && output.length > 0; index++) {
        const a = clip[index]!;
        const b = clip[(index + 1) % clip.length]!;
        const inside = ([x, y]: Point2) =>
            sign * ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) >=
            0;
        const input = output;

        output = [];

        input.forEach((current, at) => {
            const previous = input[(at + input.length - 1) % input.length]!;
            const crossing = (): Point2 => {
                const [dx, dy] = [
                    current[0] - previous[0],
                    current[1] - previous[1],
                ];
                const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
                const denominator = dx * ey - dy * ex;
                const u =
                    denominator === 0
                        ? 0
                        : ((a[0] - previous[0]) * ey -
                              (a[1] - previous[1]) * ex) /
                          denominator;

                return [previous[0] + u * dx, previous[1] + u * dy];
            };

            if (inside(current)) {
                if (!inside(previous)) {
                    output.push(crossing());
                }

                output.push(current);
            } else if (inside(previous)) {
                output.push(crossing());
            }
        });
    }

    return output;
}

function cross(a: Vec, b: Vec): Vec {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

export function projectBox(
    plan: Plan,
    view: View,
    options: { translucent: boolean },
): Polygon[] {
    const { yaw_rad: yaw, pitch_rad: pitch, zoom } = view;
    const project = (point: Vec): { xy: [number, number]; depth: number } => {
        const [x, y, z] = rotate(point, yaw, pitch);

        return { xy: [x * zoom, y * zoom], depth: z };
    };
    const pieceOf = (role: PieceRole): Piece | undefined =>
        plan.pieces.find((piece) => piece.role === role);
    const polygons: Polygon[] = [];

    for (const face of faces(plan)) {
        const turned = rotate(face.normal, yaw, pitch);
        const facing = turned[2] > EDGE_ON;
        const light = Math.max(
            0,
            (turned[0] * LIGHT[0] +
                turned[1] * LIGHT[1] +
                turned[2] * LIGHT[2]) /
                LIGHT_NORM,
        );

        // Sem transparência só aparecem as faces externas viradas para o observador.
        if (!options.translucent && (face.inner || !facing)) {
            continue;
        }

        const corners = (
            [
                [0, 0],
                [face.w_m, 0],
                [face.w_m, face.h_m],
                [0, face.h_m],
            ] as [number, number][]
        ).map(([x, y]) => project(onFace(face, x, y)));
        const centre = project(onFace(face, face.w_m / 2, face.h_m / 2));

        polygons.push({
            id: face.id,
            kind: 'face',
            points: corners.map(({ xy }) => xy),
            depth: centre.depth,
            facing,
            light,
        });

        const counters: Record<string, number> = {};

        for (const cutout of pieceOf(face.role)?.cutouts ?? []) {
            counters[cutout.kind] = (counters[cutout.kind] ?? 0) + 1;
            const shape = outline(cutout);

            if (shape === undefined) {
                continue;
            }

            const lifted = shape.map(([x, y]) => project(onFace(face, x, y)));
            const id = `${face.id}:${cutout.kind}-${counters[cutout.kind]}`;
            const hole = lifted.map(({ xy }) => xy);

            polygons.push({
                id,
                kind: 'cutout',
                points: hole,
                depth: centre.depth + CUTOUT_LIFT_M,
                part: cutout.kind,
                facing,
                light,
            });

            // Atrás do painel (no sentido contrário à normal), por onde o cone e o duto entram.
            const behind = (x: number, y: number, depth_m: number): Vec => {
                const point = onFace(face, x, y);

                return [
                    point[0] - face.normal[0] * depth_m,
                    point[1] - face.normal[1] * depth_m,
                    point[2] - face.normal[2] * depth_m,
                ];
            };

            if (cutout.kind === 'driver' && cutout.center !== undefined) {
                const { center } = cutout;
                const size =
                    cutout.shape === 'round'
                        ? (cutout.diameter_m ?? 0)
                        : Math.min(cutout.width_m ?? 0, cutout.height_m ?? 0);
                const layer = (
                    name: 'flange' | 'cone' | 'cap',
                    contour: Point2[],
                    recess_m: number,
                    lift: number,
                ) => {
                    const projected = contour.map(([x, y]) =>
                        project(behind(x, y, recess_m)),
                    );

                    polygons.push({
                        id: `${id}:${name}`,
                        kind: 'detail',
                        layer: name,
                        points: projected.map(({ xy }) => xy),
                        depth: centre.depth + CUTOUT_LIFT_M * lift,
                        part: 'driver',
                        facing,
                        light,
                    });
                };

                if (size > 0) {
                    // O aro (a borda do cone sobre o painel) vem por baixo do furo.
                    layer(
                        'flange',
                        scaled(shape, center, FLANGE_SCALE),
                        0,
                        0.5,
                    );
                    layer(
                        'cone',
                        circle(center, (size / 2) * CONE_SCALE),
                        size * CONE_RECESS,
                        1.5,
                    );
                    layer(
                        'cap',
                        circle(center, (size / 2) * CAP_SCALE),
                        size * CAP_RECESS,
                        2,
                    );
                }
            }

            if (cutout.kind === 'port') {
                const rear = face.role === 'back';
                const length = rear
                    ? plan.port_rear_length_m
                    : plan.port_length_m;
                // O duto não passa da profundidade da câmara em que está.
                const chamber = plan.dimensions.chambers;
                const room = rear
                    ? (chamber?.rear_d_m ?? plan.dimensions.internal.d_m)
                    : (chamber?.front_d_m ?? plan.dimensions.internal.d_m);

                if (length !== undefined && length > 0) {
                    const reach = Math.min(length, room);

                    shape.forEach(([ax, ay], index) => {
                        const [bx, by] = shape[(index + 1) % shape.length]!;
                        const a = onFace(face, ax, ay);
                        const b = onFace(face, bx, by);
                        const quad = [
                            a,
                            b,
                            behind(bx, by, reach),
                            behind(ax, ay, reach),
                        ].map(project);
                        // Parede vista por dentro: a normal aponta para o eixo do duto.
                        const inward = cross(face.normal, [
                            b[0] - a[0],
                            b[1] - a[1],
                            b[2] - a[2],
                        ]);
                        const turnedInward = rotate(inward, yaw, pitch);
                        const visible = turnedInward[2] > EDGE_ON;
                        const length3 = Math.hypot(...inward) || 1;
                        const wallLight = Math.max(
                            0,
                            (turnedInward[0] * LIGHT[0] +
                                turnedInward[1] * LIGHT[1] +
                                turnedInward[2] * LIGHT[2]) /
                                (LIGHT_NORM * length3),
                        );
                        let points = quad.map(({ xy }) => xy);
                        let depth =
                            quad.reduce((sum, { depth: z }) => sum + z, 0) / 4;

                        if (!options.translucent) {
                            // Sem transparência só se vê, pela abertura, a parede de dentro que
                            // olha para o observador, e só o que cabe no furo.
                            if (!visible) {
                                return;
                            }

                            points = clipConvex(points, hole);
                            depth = centre.depth + CUTOUT_LIFT_M * 1.5;

                            if (points.length < 3) {
                                return;
                            }
                        }

                        polygons.push({
                            id: `${id}:wall-${index + 1}`,
                            kind: 'detail',
                            layer: 'wall',
                            points,
                            depth,
                            part: 'port',
                            facing: options.translucent ? visible : facing,
                            light: wallLight,
                        });
                    });
                }
            }
        }
    }

    return polygons.sort((a, b) => a.depth - b.depth);
}

// Afastamento das cotas em relação às arestas, como fração do raio (meia diagonal da caixa).
const DIMENSION_OFFSET = 0.08;

// As três cotas (largura, altura, profundidade externas), cada uma na aresta que fica no contorno
// da caixa na tela e afastada dela para fora, para nunca cair sobre uma face nem duplicar uma
// linha do desenho. Mesmas coordenadas de `projectBox`; o texto formatado é de quem desenha.
export function dimensionLines(plan: Plan, view: View): DimensionLine[] {
    const { yaw_rad: yaw, pitch_rad: pitch, zoom } = view;
    const { w_m, h_m, d_m } = plan.dimensions.external;
    const size: Vec = [w_m, h_m, d_m];
    const project = (point: Vec): [number, number] => {
        const [x, y] = rotate(point, yaw, pitch);

        return [x * zoom, y * zoom];
    };
    const offset = DIMENSION_OFFSET * (Math.hypot(w_m, h_m, d_m) / 2) * zoom;
    const axes: [DimensionLine['axis'], number][] = [
        ['width', 0],
        ['height', 1],
        ['depth', 2],
    ];

    return axes.map(([axis, index]) => {
        const [a, b] = [0, 1, 2].filter((other) => other !== index);
        let best:
            | {
                  score: number;
                  edge: [[number, number], [number, number]];
                  away: [number, number];
              }
            | undefined;

        // Das quatro arestas paralelas, a mais para fora (na normal da própria aresta) é a do contorno.
        for (const sa of [-1, 1]) {
            for (const sb of [-1, 1]) {
                const start: Vec = [0, 0, 0];

                start[index] = -size[index] / 2;
                start[a] = (sa * size[a]) / 2;
                start[b] = (sb * size[b]) / 2;

                const end: Vec = [...start];

                end[index] = size[index] / 2;

                const from = project(start);
                const to = project(end);
                const middle = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
                const [dx, dy] = [to[0] - from[0], to[1] - from[1]];
                const length = Math.hypot(dx, dy);
                const far = Math.hypot(middle[0], middle[1]);
                // Olhando ao longo do eixo a aresta vira um ponto: vale a direção a partir do centro.
                const candidates: [number, number][] =
                    length > 1e-12
                        ? [
                              [-dy / length, dx / length],
                              [dy / length, -dx / length],
                          ]
                        : [
                              far > 1e-12
                                  ? [middle[0] / far, middle[1] / far]
                                  : [0, 1],
                          ];

                for (const away of candidates) {
                    const score = middle[0] * away[0] + middle[1] * away[1];

                    if (best === undefined || score > best.score) {
                        best = { score, edge: [from, to], away };
                    }
                }
            }
        }

        const { edge, away } = best!;
        const shift = (point: [number, number]): [number, number] => [
            point[0] + away[0] * offset,
            point[1] + away[1] * offset,
        ];
        const from = shift(edge[0]);
        const to = shift(edge[1]);

        return {
            axis,
            value_m: size[index],
            from,
            to,
            label: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
            edge,
        };
    });
}
