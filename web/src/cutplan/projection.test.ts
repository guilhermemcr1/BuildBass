import { describe, expect, test } from 'vite-plus/test';
import { simulate } from '@/engine';
import type { BoxInput, ProjectInput } from '@/engine';
import { resolveCutPlan } from './config';
import { DEFAULT_VIEW, projectBox } from './projection';
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

describe('bandpass de 6ª ordem na projeção (feature 007)', () => {
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
