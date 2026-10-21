import { describe, expect, test } from 'vite-plus/test';
import { simulate } from '@/engine';
import type { BoxInput, DriverInput, ProjectInput } from '@/engine';
import { PROPORTIONS, resolveCutPlan } from './config';
import { buildCutPlan } from './plan';
import type { CutPlanConfig, Plan } from './types';

// Driver de exemplo da bancada. A simulação é a real (não se simula à mão).
const DRIVER: DriverInput = {
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

function project(
    box: Partial<BoxInput> = {},
    count = 1,
    driver: DriverInput = DRIVER,
): ProjectInput {
    return {
        name: 'p',
        driver,
        drivers: { count, wiring: 'parallel' },
        box: {
            type: 'closed',
            vb_m3: 0.06,
            ql: 7,
            port: { shape: 'round', diameter_m: 0.1, count: 1 },
            ...box,
        },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
    };
}

function build(input: ProjectInput, config: CutPlanConfig = {}) {
    return buildCutPlan(input, simulate(input).results, resolveCutPlan(config));
}

function ready(input: ProjectInput, config: CutPlanConfig = {}): Plan {
    const result = build(input, config);

    if (result.status !== 'ready') {
        throw new Error(`plano bloqueado: ${JSON.stringify(result)}`);
    }

    return result.plan;
}

const MM = 0.0005; // 0,5 mm: precisão de 4 casas em metros (0,1 mm = 4 dígitos)

describe('dimensões da caixa selada (C1–C3)', () => {
    test('C1 — 60 L, áurea, 18 mm', () => {
        const { dimensions } = ready(project());

        expect(dimensions.internal.w_m).toBeCloseTo(0.3915, 3);
        expect(dimensions.internal.h_m).toBeCloseTo(0.6334, 3);
        expect(dimensions.internal.d_m).toBeCloseTo(0.242, 3);
        expect(dimensions.external.w_m).toBeCloseTo(0.4275, 3);
        expect(dimensions.external.h_m).toBeCloseTo(0.6694, 3);
        expect(dimensions.external.d_m).toBeCloseTo(0.278, 3);
        expect(Math.abs(dimensions.internal.w_m - 0.3915)).toBeLessThan(MM);
        expect(dimensions.chambers).toBeUndefined();
    });

    test('o volume interno é o do projeto', () => {
        const { internal } = ready(project()).dimensions;

        expect(internal.w_m * internal.h_m * internal.d_m).toBeCloseTo(
            0.06,
            12,
        );
    });

    test.each(['golden', 'louden', 'equalSteps', 'cube'] as const)(
        'C2 — a razão h:w:d é a da sugestão %s',
        (proportion) => {
            const { internal } = ready(project(), { proportion }).dimensions;
            const ratio = PROPORTIONS[proportion];

            expect(internal.h_m / internal.d_m).toBeCloseTo(
                ratio.h / ratio.d,
                12,
            );
            expect(internal.w_m / internal.d_m).toBeCloseTo(
                ratio.w / ratio.d,
                12,
            );
        },
    );

    test('C2 — proporção própria', () => {
        const { internal } = ready(project(), {
            proportion: 'custom',
            custom: { h: 2.2, w: 1.5, d: 1 },
        }).dimensions;

        expect(internal.h_m / internal.d_m).toBeCloseTo(2.2, 12);
        expect(internal.w_m / internal.d_m).toBeCloseTo(1.5, 12);
    });

    test('C3 — os reforços aumentam o volume interno por eles mesmos', () => {
        const { internal } = ready(project(), { braces_m3: 0.002 }).dimensions;

        expect(internal.w_m * internal.h_m * internal.d_m).toBeCloseTo(
            0.062,
            12,
        );
    });

    test('a espessura muda só as medidas externas', () => {
        const thin = ready(project(), { thickness_m: 0.012 }).dimensions;
        const thick = ready(project(), { thickness_m: 0.025 }).dimensions;

        expect(thin.internal).toEqual(thick.internal);
        expect(thick.external.w_m - thin.external.w_m).toBeCloseTo(
            2 * (0.025 - 0.012),
            12,
        );
    });
});

describe('peças (C7, C8)', () => {
    test('C8 — seis peças em cinco linhas, com as medidas da convenção', () => {
        const plan = ready(project());
        const { external, internal } = plan.dimensions;
        const t = plan.thickness_m;
        const byRole = (role: string) =>
            plan.pieces.find((piece) => piece.role === role);

        expect(plan.pieces).toHaveLength(5);
        expect(plan.pieces.reduce((sum, p) => sum + p.quantity, 0)).toBe(6);
        expect(plan.pieces.map((p) => p.role)).toEqual([
            'front',
            'back',
            'top',
            'bottom',
            'side',
        ]);
        expect(byRole('side')?.quantity).toBe(2);
        expect(byRole('front')).toMatchObject({
            w_m: external.w_m,
            h_m: external.h_m,
            thickness_m: t,
        });
        expect(byRole('back')).toMatchObject({
            w_m: external.w_m,
            h_m: external.h_m,
        });
        expect(byRole('top')).toMatchObject({
            w_m: external.w_m,
            h_m: external.d_m - 2 * t,
        });
        expect(byRole('bottom')).toMatchObject({
            w_m: external.w_m,
            h_m: external.d_m - 2 * t,
        });
        expect(byRole('side')).toMatchObject({
            w_m: external.d_m - 2 * t,
            h_m: internal.h_m,
        });
        expect(byRole('divider')).toBeUndefined();
    });

    test('a dutada tem as mesmas seis peças', () => {
        const plan = ready(project({ type: 'vented', fb_hz: 32 }));

        expect(plan.pieces.reduce((sum, p) => sum + p.quantity, 0)).toBe(6);
    });

    test('C7 — montar as peças reproduz as dimensões do plano', () => {
        for (const config of [{}, { thickness_m: 0.025, braces_m3: 0.003 }]) {
            const plan = ready(project(), config);
            const t = plan.thickness_m;
            const piece = (role: string) =>
                plan.pieces.find((p) => p.role === role);
            const front = piece('front');
            const top = piece('top');
            const side = piece('side');

            const externalW = front?.w_m ?? 0;
            const externalH = front?.h_m ?? 0;
            const externalD = (top?.h_m ?? 0) + 2 * t;

            expect(externalW).toBeCloseTo(plan.dimensions.external.w_m, 12);
            expect(externalH).toBeCloseTo(plan.dimensions.external.h_m, 12);
            expect(externalD).toBeCloseTo(plan.dimensions.external.d_m, 12);
            expect(externalW - 2 * t).toBeCloseTo(
                plan.dimensions.internal.w_m,
                12,
            );
            expect(externalH - 2 * t).toBeCloseTo(
                plan.dimensions.internal.h_m,
                12,
            );
            expect(externalD - 2 * t).toBeCloseTo(
                plan.dimensions.internal.d_m,
                12,
            );
            expect(side?.h_m).toBeCloseTo(externalH - 2 * t, 12);
            expect(side?.w_m).toBeCloseTo(top?.h_m ?? 0, 12);
        }
    });
});

describe('bloqueios (C11, C12) e determinismo (C13)', () => {
    test('C11 — sem volume: bloqueado e diz qual', () => {
        const { vb_m3: _vb, ...withoutVolume } = project().box;

        expect(build({ ...project(), box: withoutVolume })).toEqual({
            status: 'blocked',
            missing: ['vb_m3'],
            invalid: [],
        });
        expect(
            build({
                ...project(),
                box: { ...withoutVolume, type: 'vented' },
            }),
        ).toMatchObject({ status: 'blocked', missing: ['vb_m3'] });
    });

    test('C11 — volume não positivo é inválido, não faltando', () => {
        expect(build(project({ vb_m3: 0 }))).toEqual({
            status: 'blocked',
            missing: [],
            invalid: ['vb_m3'],
        });
        expect(build(project({ vb_m3: -1 }))).toMatchObject({
            invalid: ['vb_m3'],
        });
    });

    test('C12 — configuração inválida bloqueia sem exceção', () => {
        expect(build(project(), { thickness_m: 0 })).toEqual({
            status: 'blocked',
            missing: [],
            invalid: ['thickness_m'],
        });
        expect(
            build(project(), {
                proportion: 'custom',
                custom: { h: 0, w: 1, d: 1 },
            }),
        ).toMatchObject({ status: 'blocked', invalid: ['ratio'] });
        expect(build(project(), { braces_m3: Number.NaN })).toMatchObject({
            invalid: ['braces_m3'],
        });
    });

    test('C13 — mesma entrada, mesmo plano', () => {
        const input = project({ type: 'vented', fb_hz: 32 }, 2);

        expect(build(input, { cutout_m: 0.285 })).toEqual(
            build(input, { cutout_m: 0.285 }),
        );
    });
});

describe('recortes (C9 no plano)', () => {
    const front = (plan: Plan) =>
        plan.pieces.find((piece) => piece.role === 'front');

    test('um driver com diâmetro fica centralizado na frente', () => {
        const plan = ready(project(), { cutout_m: 0.285 });
        const panel = front(plan);

        expect(panel?.cutouts).toHaveLength(1);
        expect(panel?.cutouts[0]).toMatchObject({
            kind: 'driver',
            shape: 'round',
            diameter_m: 0.285,
        });
        expect(panel?.cutouts[0].center?.x_m).toBeCloseTo(
            (panel?.w_m ?? 0) / 2,
            12,
        );
        expect(panel?.cutouts[0].center?.y_m).toBeCloseTo(
            (panel?.h_m ?? 0) / 2,
            12,
        );
        expect(panel?.cutouts[0].pending).toBeUndefined();
    });

    test('sem o diâmetro, o recorte do driver fica pendente e sem posição', () => {
        const panel = front(ready(project()));

        expect(panel?.cutouts[0]).toEqual({
            kind: 'driver',
            shape: 'round',
            pending: ['cutout_m'],
        });
    });

    test('um recorte por driver', () => {
        const panel = front(ready(project({}, 3), { cutout_m: 0.1 }));

        expect(panel?.cutouts.map((c) => c.kind)).toEqual([
            'driver',
            'driver',
            'driver',
        ]);
    });

    test('selada não tem recorte de duto, mesmo com o duto preenchido', () => {
        const panel = front(ready(project(), { cutout_m: 0.285 }));

        expect(panel?.cutouts.some((c) => c.kind === 'port')).toBe(false);
    });

    test('dutada: driver e duto na frente, sem se sobrepor', () => {
        const plan = ready(
            project({
                type: 'vented',
                fb_hz: 32,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            }),
            { cutout_m: 0.285 },
        );
        const panel = front(plan);
        const [driver, port] = panel?.cutouts ?? [];

        expect(driver.kind).toBe('driver');
        expect(port).toMatchObject({
            kind: 'port',
            shape: 'round',
            diameter_m: 0.1,
        });
        expect(
            Math.abs((port.center?.y_m ?? 0) - (driver.center?.y_m ?? 0)),
        ).toBeGreaterThanOrEqual(0.285 / 2 + 0.1 / 2);
    });

    test('duto retangular e triangular levem as medidas do projeto', () => {
        const rect = front(
            ready(
                project({
                    type: 'vented',
                    fb_hz: 32,
                    port: {
                        shape: 'rect',
                        width_m: 0.05,
                        height_m: 0.2,
                        count: 2,
                    },
                }),
                { cutout_m: 0.2 },
            ),
        );
        const triangle = front(
            ready(
                project({
                    type: 'vented',
                    fb_hz: 32,
                    port: {
                        shape: 'triangle',
                        base_m: 0.1,
                        height_m: 0.08,
                        count: 1,
                    },
                }),
                { cutout_m: 0.2 },
            ),
        );

        expect(rect?.cutouts.filter((c) => c.kind === 'port')).toEqual([
            expect.objectContaining({
                shape: 'rect',
                width_m: 0.05,
                height_m: 0.2,
            }),
            expect.objectContaining({
                shape: 'rect',
                width_m: 0.05,
                height_m: 0.2,
            }),
        ]);
        expect(triangle?.cutouts[1]).toMatchObject({
            shape: 'triangle',
            base_m: 0.1,
            height_m: 0.08,
        });
    });

    test('duto sem medida fica pendente com as chaves que faltam', () => {
        const panel = front(
            ready(
                project({
                    type: 'vented',
                    fb_hz: 32,
                    port: { shape: 'rect', width_m: 0.05, count: 1 },
                }),
                { cutout_m: 0.2 },
            ),
        );

        expect(panel?.cutouts[1]).toMatchObject({
            kind: 'port',
            shape: 'rect',
            pending: ['height_m'],
        });
        expect(panel?.cutouts[1].center).toBeUndefined();
    });

    test('o comprimento do tubo vem da simulação', () => {
        const input = project({ type: 'vented', fb_hz: 32 });
        const plan = ready(input);

        expect(plan.port_length_m).toBe(simulate(input).results.port_length_m);
        expect(plan.port_length_m).toBeGreaterThan(0);
        expect(ready(project()).port_length_m).toBeUndefined();
    });
});
