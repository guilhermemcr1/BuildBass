import { describe, expect, test } from 'vite-plus/test';
import { simulate } from '@/engine';
import type { BoxInput, ProjectInput } from '@/engine';
import { resolveCutPlan } from './config';
import { buildCutPlan } from './plan';
import { cutTotals } from './totals';
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

const CASES: [string, Partial<BoxInput>][] = [
    ['selada', {}],
    ['dutada', { type: 'vented', fb_hz: 35 }],
    ['bandpass', { type: 'bandpass', vr_m3: 0.04, vf_m3: 0.03, fb_hz: 45 }],
    [
        'bandpass 6ª ordem',
        {
            type: 'bandpass6',
            vr_m3: 0.04,
            vf_m3: 0.03,
            fb_hz: 45,
            fb_rear_hz: 38,
            port_rear: { shape: 'round', diameter_m: 0.1, count: 1 },
        } as Partial<BoxInput>,
    ],
];

describe('corte total (feature 008)', () => {
    test.each(CASES)(
        '%s: "com desconto" bate com a soma das peças do plano',
        (_name, box) => {
            const caixa = plan(box);
            const { net } = cutTotals(caixa);
            const pieces = caixa.pieces.reduce(
                (sum, piece) => sum + piece.quantity,
                0,
            );
            const area = caixa.pieces.reduce(
                (sum, piece) => sum + piece.quantity * piece.w_m * piece.h_m,
                0,
            );
            const cut = caixa.pieces.reduce(
                (sum, piece) =>
                    sum + piece.quantity * 2 * (piece.w_m + piece.h_m),
                0,
            );

            expect(net.pieces).toBe(pieces);
            expect(net.area_m2).toBeCloseTo(area, 12);
            expect(net.cutLength_m).toBeCloseTo(cut, 12);
        },
    );

    test('selada: "sem desconto" usa as seis faces pelas medidas internas', () => {
        const caixa = plan();
        const { w_m, h_m, d_m } = caixa.dimensions.internal;
        const { gross } = cutTotals(caixa);

        expect(gross.pieces).toBe(6);
        expect(gross.area_m2).toBeCloseTo(
            2 * (w_m * h_m + w_m * d_m + h_m * d_m),
            12,
        );
        expect(gross.cutLength_m).toBeCloseTo(
            2 * (2 * (w_m + h_m) + 2 * (w_m + d_m) + 2 * (h_m + d_m)),
            12,
        );
    });

    test('bandpass: a divisória entra pela medida interna da câmara', () => {
        const caixa = plan({ type: 'bandpass', vr_m3: 0.04, vf_m3: 0.03 });
        const { w_m, h_m, d_m } = caixa.dimensions.internal;
        const { gross } = cutTotals(caixa);

        expect(gross.pieces).toBe(7);
        expect(gross.area_m2).toBeCloseTo(
            2 * (w_m * h_m + w_m * d_m + h_m * d_m) + w_m * h_m,
            12,
        );
    });

    test.each(CASES)(
        '%s: a diferença é "com − sem" e nunca negativa',
        (_name, box) => {
            const { gross, net, difference } = cutTotals(plan(box));

            expect(difference.pieces).toBe(net.pieces - gross.pieces);
            expect(difference.area_m2).toBeCloseTo(
                net.area_m2 - gross.area_m2,
                12,
            );
            expect(difference.cutLength_m).toBeCloseTo(
                net.cutLength_m - gross.cutLength_m,
                12,
            );
            expect(difference.area_m2).toBeGreaterThanOrEqual(0);
            expect(difference.cutLength_m).toBeGreaterThanOrEqual(0);
            expect(difference.pieces).toBe(0);
        },
    );

    test('a diferença cresce com a espessura e some quando ela é quase zero', () => {
        const thin = cutTotals(plan({}, { thickness_m: 0.009 })).difference;
        const thick = cutTotals(plan({}, { thickness_m: 0.025 })).difference;

        expect(thick.area_m2).toBeGreaterThan(thin.area_m2);
        expect(thick.cutLength_m).toBeGreaterThan(thin.cutLength_m);
        expect(thin.area_m2).toBeGreaterThan(0);
    });

    test('é determinística', () => {
        const caixa = plan();

        expect(cutTotals(caixa)).toEqual(cutTotals(caixa));
    });
});
