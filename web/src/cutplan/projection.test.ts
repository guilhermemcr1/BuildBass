import { describe, expect, test } from 'vite-plus/test';
import { simulate } from '@/engine';
import type { BoxInput, ProjectInput } from '@/engine';
import { resolveCutPlan } from './config';
import { DEFAULT_VIEW, dimensionLines, projectBox } from './projection';
import { buildCutPlan } from './plan';
import type { CutPlanConfig, Plan } from './types';

const DRIVER = {
    fs_hz: 28,
    qts: 0.38,
    qes: 0.42,
    qms: 4.1,
    vas_m3: 0.085,
    re_ohm: 3.6,
    sd_m2: 0.0491,
    xmax_m: 0.014,
    vd_m3: 0.002,
};

function plan(box: Partial<BoxInput> = {}, config: CutPlanConfig = {}): Plan {
    const input: ProjectInput = {
        name: 'p',
        driver: DRIVER,
        drivers: { count: 1, wiring: 'parallel' },
        box: {
            type: 'closed',
            vb_m3: 0.06,
            ql: 7,
            port: { shape: 'round', diameter_m: 0.1, count: 1 },
            ...box,
        },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
    };
    const result = buildCutPlan(
        input,
        simulate(input).results,
        resolveCutPlan({ cutout_m: 0.2, ...config }),
    );

    if (result.status !== 'ready') {
        throw new Error('bloqueado');
    }

    return result.plan;
}

const FLAT = { yaw_rad: 0, pitch_rad: 0, zoom: 1 };
const ids = (polygons: { id: string }[]) => polygons.map(({ id }) => id);

describe('projeção da caixa (C15)', () => {
    test('de frente, só a frente aparece e é um retângulo W_ext × H_ext', () => {
        const caixa = plan();
        const polygons = projectBox(caixa, FLAT, { translucent: false });
        const face = polygons.find(({ id }) => id === 'front');
        const { w_m, h_m } = caixa.dimensions.external;

        expect(ids(polygons.filter(({ kind }) => kind === 'face'))).toEqual([
            'front',
        ]);
        expect(face?.points).toHaveLength(4);

        const xs = face?.points.map(([x]) => x) ?? [];
        const ys = face?.points.map(([, y]) => y) ?? [];

        expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(w_m, 9);
        expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(h_m, 9);
        expect((Math.max(...xs) + Math.min(...xs)) / 2).toBeCloseTo(0, 9);
        expect((Math.max(...ys) + Math.min(...ys)) / 2).toBeCloseTo(0, 9);
    });

    test('o recorte do driver vira polígono com id da peça e do tipo', () => {
        const polygons = projectBox(plan({ type: 'vented', fb_hz: 60 }), FLAT, {
            translucent: false,
        });

        expect(ids(polygons)).toContain('front:driver-1');
        expect(ids(polygons)).toContain('front:port-1');

        const driver = polygons.find(({ id }) => id === 'front:driver-1');

        expect(driver?.kind).toBe('cutout');
        expect(driver?.points).toHaveLength(24);
        // O polígono do recorte vem depois da face para ser desenhado por cima.
        expect(ids(polygons).indexOf('front:driver-1')).toBeGreaterThan(
            ids(polygons).indexOf('front'),
        );
    });

    test('girar 90° em torno do eixo vertical troca a face visível', () => {
        const polygons = projectBox(
            plan(),
            { yaw_rad: Math.PI / 2, pitch_rad: 0, zoom: 1 },
            { translucent: false },
        );

        expect(ids(polygons)).not.toContain('front');
        expect(ids(polygons)).toContain('side-1');
    });

    test('com inclinação positiva o topo aparece; com negativa, a base', () => {
        const up = projectBox(
            plan(),
            { ...FLAT, pitch_rad: 0.5 },
            {
                translucent: false,
            },
        );
        const down = projectBox(
            plan(),
            { ...FLAT, pitch_rad: -0.5 },
            {
                translucent: false,
            },
        );

        expect(ids(up)).toContain('top');
        expect(ids(up)).not.toContain('bottom');
        expect(ids(down)).toContain('bottom');
        expect(ids(down)).not.toContain('top');
    });

    test('opaca, a vista padrão mostra três faces e nunca as de trás', () => {
        const faces = projectBox(plan(), DEFAULT_VIEW, {
            translucent: false,
        }).filter(({ kind }) => kind === 'face');

        expect(faces).toHaveLength(3);
        expect(ids(faces)).not.toContain('back');
    });

    test('translúcida traz as seis faces, de trás para frente', () => {
        const polygons = projectBox(plan(), DEFAULT_VIEW, {
            translucent: true,
        });
        const faces = polygons.filter(({ kind }) => kind === 'face');

        expect(faces).toHaveLength(6);

        for (let index = 1; index < polygons.length; index += 1) {
            expect(polygons[index].depth).toBeGreaterThanOrEqual(
                polygons[index - 1].depth,
            );
        }
    });

    test('a bandpass traz a divisória só na vista translúcida, com o recorte do driver', () => {
        const bandpass = plan({
            type: 'bandpass',
            vr_m3: 0.04,
            vf_m3: 0.06,
            fb_hz: 45,
        });
        const opaque = projectBox(bandpass, DEFAULT_VIEW, {
            translucent: false,
        });
        const translucent = projectBox(bandpass, DEFAULT_VIEW, {
            translucent: true,
        });

        expect(ids(opaque)).not.toContain('divider');
        expect(
            ids(translucent.filter(({ kind }) => kind === 'face')),
        ).toHaveLength(7);
        expect(ids(translucent)).toContain('divider');
        expect(ids(translucent)).toContain('divider:driver-1');
        expect(ids(translucent)).toContain('front:port-1');
    });

    test('a divisória fica entre a traseira e a frontal', () => {
        const bandpass = plan({
            type: 'bandpass',
            vr_m3: 0.04,
            vf_m3: 0.06,
            fb_hz: 45,
        });
        const polygons = projectBox(bandpass, FLAT, { translucent: true });
        const depth = (id: string) =>
            polygons.find((polygon) => polygon.id === id)?.depth ?? Number.NaN;

        expect(depth('divider')).toBeGreaterThan(depth('back'));
        expect(depth('divider')).toBeLessThan(depth('front'));
    });

    test('o zoom escala os pontos', () => {
        const one = projectBox(plan(), FLAT, { translucent: false });
        const two = projectBox(
            plan(),
            { ...FLAT, zoom: 2 },
            {
                translucent: false,
            },
        );

        one[0].points.forEach(([x, y], index) => {
            expect(two[0].points[index][0]).toBeCloseTo(2 * x, 12);
            expect(two[0].points[index][1]).toBeCloseTo(2 * y, 12);
        });
    });

    test('é determinística e recortes sem posição não viram polígono', () => {
        const caixa = plan({}, { cutout_m: undefined });

        expect(projectBox(caixa, DEFAULT_VIEW, { translucent: true })).toEqual(
            projectBox(caixa, DEFAULT_VIEW, { translucent: true }),
        );
        expect(
            ids(projectBox(caixa, FLAT, { translucent: false })),
        ).not.toContain('front:driver-1');
    });
});

describe('bandpass de 6ª ordem na projeção', () => {
    const sixth = () =>
        plan({
            type: 'bandpass6',
            vr_m3: 0.08,
            vf_m3: 0.04,
            fb_hz: 45,
            fb_rear_hz: 30,
            port_rear: { shape: 'round', diameter_m: 0.08, count: 1 },
        });

    test('as sete peças são as mesmas e o recorte do duto traseiro entra no fundo', () => {
        const polygons = projectBox(sixth(), DEFAULT_VIEW, {
            translucent: true,
        });

        expect(
            ids(polygons.filter(({ kind }) => kind === 'face')),
        ).toHaveLength(7);
        expect(ids(polygons)).toContain('back:port-1');
        expect(ids(polygons)).toContain('front:port-1');
        expect(ids(polygons)).toContain('divider:driver-1');
    });

    test('visto por trás, só o fundo aparece e o recorte fica dentro dele', () => {
        const polygons = projectBox(
            sixth(),
            { yaw_rad: Math.PI, pitch_rad: 0, zoom: 1 },
            { translucent: false },
        );
        const face = polygons.find(({ id }) => id === 'back');
        const hole = polygons.find(({ id }) => id === 'back:port-1');
        const xs = (face?.points ?? []).map(([x]) => x);
        const ys = (face?.points ?? []).map(([, y]) => y);

        expect(face).toBeDefined();
        expect(hole).toBeDefined();
        for (const [x, y] of hole?.points ?? []) {
            expect(x).toBeGreaterThan(Math.min(...xs));
            expect(x).toBeLessThan(Math.max(...xs));
            expect(y).toBeGreaterThan(Math.min(...ys));
            expect(y).toBeLessThan(Math.max(...ys));
        }
    });
});

describe('cotas e peças do 3D', () => {
    const VIEWS = [
        DEFAULT_VIEW,
        { yaw_rad: 0.7, pitch_rad: -0.3, zoom: 1 },
        { yaw_rad: 2.4, pitch_rad: 0.9, zoom: 2 },
        { yaw_rad: -1.2, pitch_rad: 0.2, zoom: 0.5 },
    ];

    test('devolve exatamente três cotas com as medidas externas', () => {
        const caixa = plan();
        const { w_m, h_m, d_m } = caixa.dimensions.external;

        for (const view of VIEWS) {
            const lines = dimensionLines(caixa, view);

            expect(lines.map(({ axis }) => axis)).toEqual([
                'width',
                'height',
                'depth',
            ]);
            expect(lines.map(({ value_m }) => value_m)).toEqual([
                w_m,
                h_m,
                d_m,
            ]);
        }
    });

    test('o comprimento projetado de cada cota é o da aresta projetada', () => {
        const caixa = plan();
        const { w_m, h_m, d_m } = caixa.dimensions.external;

        for (const { yaw_rad: yaw, pitch_rad: pitch, zoom } of VIEWS) {
            const [width, height, depth] = dimensionLines(caixa, {
                yaw_rad: yaw,
                pitch_rad: pitch,
                zoom,
            }).map(({ from, to }) =>
                Math.hypot(to[0] - from[0], to[1] - from[1]),
            );

            expect(width).toBeCloseTo(
                w_m *
                    zoom *
                    Math.hypot(Math.cos(yaw), Math.sin(yaw) * Math.sin(pitch)),
                9,
            );
            expect(height).toBeCloseTo(h_m * zoom * Math.cos(pitch), 9);
            expect(depth).toBeCloseTo(
                d_m *
                    zoom *
                    Math.hypot(Math.sin(yaw), Math.cos(yaw) * Math.sin(pitch)),
                9,
            );
        }
    });

    test('cada cota fica fora da caixa: afastada 8 % do raio de uma aresta do contorno', () => {
        const caixa = plan();

        for (const view of VIEWS) {
            const hull = projectBox(caixa, view, { translucent: true })
                .filter(({ kind }) => kind === 'face')
                .flatMap(({ points }) => points);
            const offset =
                0.08 *
                (Math.hypot(...Object.values(caixa.dimensions.external)) / 2) *
                view.zoom;

            for (const { from, to, edge } of dimensionLines(caixa, view)) {
                // A linha é paralela à aresta e está à distância do afastamento.
                expect(
                    Math.hypot(from[0] - edge[0][0], from[1] - edge[0][1]),
                ).toBeCloseTo(offset, 9);
                expect(
                    Math.hypot(to[0] - edge[1][0], to[1] - edge[1][1]),
                ).toBeCloseTo(offset, 9);

                // E nenhum vértice da caixa passa do lado de fora dela: nada de cota sobre faces.
                const [nx, ny] = [from[0] - edge[0][0], from[1] - edge[0][1]];
                const reach = (point: [number, number]) =>
                    (point[0] - edge[0][0]) * nx + (point[1] - edge[0][1]) * ny;

                for (const point of hull) {
                    expect(reach(point)).toBeLessThanOrEqual(1e-9);
                }
            }
        }
    });

    test('o texto fica no meio da linha e a função é determinística', () => {
        const caixa = plan();
        const first = dimensionLines(caixa, DEFAULT_VIEW);

        for (const { from, to, label } of first) {
            expect(label[0]).toBeCloseTo((from[0] + to[0]) / 2, 12);
            expect(label[1]).toBeCloseTo((from[1] + to[1]) / 2, 12);
        }
        expect(dimensionLines(caixa, DEFAULT_VIEW)).toEqual(first);
    });

    test('a bandpass usa as medidas externas da caixa inteira', () => {
        const caixa = plan({ type: 'bandpass', vr_m3: 0.04, vf_m3: 0.03 });
        const { w_m } = caixa.dimensions.external;

        expect(dimensionLines(caixa, DEFAULT_VIEW)[0].value_m).toBe(w_m);
    });

    test('os recortes saem marcados como driver ou duto, sem mudar os polígonos', () => {
        const caixa = plan({ type: 'vented', fb_hz: 35 });
        const polygons = projectBox(caixa, FLAT, { translucent: true });
        const cutouts = polygons.filter(({ kind }) => kind === 'cutout');

        expect(cutouts.length).toBeGreaterThan(0);

        for (const cutout of cutouts) {
            expect(cutout.part).toBe(
                cutout.id.includes(':driver-') ? 'driver' : 'port',
            );
        }
        expect(
            polygons
                .filter(({ kind }) => kind === 'face')
                .every(({ part }) => part === undefined),
        ).toBe(true);
    });
});

describe('projeção com posição manual', () => {
    test('o furo do 3D acompanha o centro gravado do recorte', () => {
        const centerOf = (box: Plan) => {
            const hole = projectBox(box, FLAT, { translucent: false }).find(
                ({ id }) => id === 'front:driver-1',
            );
            const points = hole?.points ?? [];

            return [
                points.reduce((sum, [x]) => sum + x, 0) / points.length,
                points.reduce((sum, [, y]) => sum + y, 0) / points.length,
            ];
        };
        const auto = plan();
        const front = auto.pieces.find(({ role }) => role === 'front');
        const auto_center = front?.cutouts[0].center ?? { x_m: 0, y_m: 0 };
        const moved = plan(
            {},
            {
                positions: [
                    {
                        piece: 'front',
                        kind: 'driver',
                        n: 1,
                        x_m: auto_center.x_m - 0.05,
                        y_m: auto_center.y_m + 0.02,
                    },
                ],
            },
        );
        const [ax, ay] = centerOf(auto);
        const [mx, my] = centerOf(moved);

        // De frente, x da tela segue a largura; o sinal de y depende da convenção da tela.
        expect(Math.abs(mx - ax)).toBeCloseTo(0.05, 6);
        expect(Math.abs(my - ay)).toBeCloseTo(0.02, 6);
    });
});

describe('detalhes dentro dos recortes', () => {
    const detail = (polygons: ReturnType<typeof projectBox>, layer: string) =>
        polygons.filter((polygon) => polygon.layer === layer);

    test('o alto-falante tem aro maior que o furo, cone e capa menores', () => {
        const polygons = projectBox(plan(), FLAT, { translucent: false });
        const width = ({ points }: { points: [number, number][] }) => {
            const xs = points.map(([x]) => x);

            return Math.max(...xs) - Math.min(...xs);
        };
        const hole = polygons.find(({ id }) => id === 'front:driver-1')!;
        const [flange] = detail(polygons, 'flange');
        const [cone] = detail(polygons, 'cone');
        const [cap] = detail(polygons, 'cap');

        expect(width(flange!)).toBeGreaterThan(width(hole));
        expect(width(cone!)).toBeLessThan(width(hole));
        expect(width(cap!)).toBeLessThan(width(cone!));
        expect(ids(polygons).indexOf(flange!.id)).toBeLessThan(
            ids(polygons).indexOf(hole.id),
        );
        expect(ids(polygons).indexOf(hole.id)).toBeLessThan(
            ids(polygons).indexOf(cone!.id),
        );
    });

    test.each([
        ['round', { shape: 'round', diameter_m: 0.1, count: 1 }, 24],
        ['rect', { shape: 'rect', width_m: 0.12, height_m: 0.05, count: 1 }, 4],
        [
            'triangle',
            { shape: 'triangle', base_m: 0.1, height_m: 0.08, count: 1 },
            3,
        ],
    ] as const)(
        'o duto %s tem uma parede por lado, só as que olham para dentro',
        (_name, port, sides) => {
            const caixa = plan({ type: 'vented', fb_hz: 35, port });
            const translucent = detail(
                projectBox(caixa, DEFAULT_VIEW, { translucent: true }),
                'wall',
            );
            const solid = detail(
                projectBox(caixa, DEFAULT_VIEW, { translucent: false }),
                'wall',
            );

            expect(translucent).toHaveLength(sides);
            expect(solid.length).toBeGreaterThan(0);
            expect(solid.length).toBeLessThan(sides);
            expect(translucent.every(({ part }) => part === 'port')).toBe(true);
        },
    );

    test('visto de frente, as paredes do duto ficam de lado e não aparecem', () => {
        const caixa = plan({ type: 'vented', fb_hz: 35 });

        expect(
            detail(projectBox(caixa, FLAT, { translucent: false }), 'wall'),
        ).toHaveLength(0);
    });

    test('pela abertura só se vê a parede dentro do furo', () => {
        const caixa = plan({ type: 'vented', fb_hz: 35 });
        const polygons = projectBox(caixa, DEFAULT_VIEW, {
            translucent: false,
        });
        const hole = polygons.find(({ id }) => id === 'front:port-1')!;
        const box = (points: [number, number][]) => ({
            minX: Math.min(...points.map(([x]) => x)),
            maxX: Math.max(...points.map(([x]) => x)),
            minY: Math.min(...points.map(([, y]) => y)),
            maxY: Math.max(...points.map(([, y]) => y)),
        });
        const bounds = box(hole.points);

        for (const wall of detail(polygons, 'wall')) {
            const wallBounds = box(wall.points);

            expect(wallBounds.minX).toBeGreaterThanOrEqual(bounds.minX - 1e-9);
            expect(wallBounds.maxX).toBeLessThanOrEqual(bounds.maxX + 1e-9);
            expect(wallBounds.minY).toBeGreaterThanOrEqual(bounds.minY - 1e-9);
            expect(wallBounds.maxY).toBeLessThanOrEqual(bounds.maxY + 1e-9);
        }
    });
});
