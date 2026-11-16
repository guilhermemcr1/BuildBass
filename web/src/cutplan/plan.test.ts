import { describe, expect, test } from 'vite-plus/test';
import { simulate } from '@/engine';
import type { BoxInput, DriverInput, ProjectInput } from '@/engine';
import { PROPORTIONS, resolveCutPlan } from './config';
import { buildCutPlan } from './plan';
import type { CutPlanConfig, DriverBody, Plan } from './types';

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
            ref: { piece: 'front', kind: 'driver', n: 1 },
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

const warningIds = (plan: Plan) => plan.warnings.map(({ id }) => id);

describe('conferência de volume (C4, C5, C16)', () => {
    test('C4 — selada com 2 drivers e reforços fecha com a simulação', () => {
        const input = project({}, 2);
        const plan = ready(input, { braces_m3: 0.003 });
        const [main] = plan.volume.chambers;

        expect(plan.volume.chambers).toHaveLength(1);
        expect(main.id).toBe('main');
        expect(main.internal_m3).toBeCloseTo(0.063, 9);
        expect(main.braces_m3).toBe(0.003);
        expect(main.drivers_m3).toBeCloseTo(0.004, 12);
        expect(main.ports_m3).toBe(0);
        expect(main.simulated_m3).toBe(simulate(input).results.net_volume_m3);
        expect(main.difference_ratio).toBeLessThanOrEqual(1e-9);
        expect(plan.volume.matchesSimulation).toBe(true);
    });

    test('C5 — dutada com duto redondo e retangular fecha com a simulação', () => {
        for (const port of [
            { shape: 'round' as const, diameter_m: 0.1, count: 2 },
            { shape: 'rect' as const, width_m: 0.3, height_m: 0.05, count: 1 },
        ]) {
            const input = project({ type: 'vented', fb_hz: 32, port });
            const plan = ready(input);
            const [main] = plan.volume.chambers;

            expect(main.ports_m3).toBeGreaterThan(0);
            expect(main.net_m3).toBeCloseTo(
                simulate(input).results.net_volume_m3 as number,
                9,
            );
            expect(plan.volume.matchesSimulation).toBe(true);
        }
    });

    test('C16 — varredura de tipos de duto, proporções, espessuras e drivers', () => {
        const ports = [
            { shape: 'round' as const, diameter_m: 0.1, count: 1 },
            { shape: 'rect' as const, width_m: 0.25, height_m: 0.06, count: 1 },
            {
                shape: 'triangle' as const,
                base_m: 0.15,
                height_m: 0.1,
                count: 2,
            },
        ];
        const proportions = [
            'golden',
            'louden',
            'equalSteps',
            'cube',
            'custom',
        ] as const;

        for (const port of ports) {
            for (const proportion of proportions) {
                for (const thickness_m of [0.012, 0.018, 0.025]) {
                    for (let count = 1; count <= 8; count += 1) {
                        const input = project(
                            { type: 'vented', vb_m3: 0.12, fb_hz: 35, port },
                            count,
                        );
                        const plan = ready(input, {
                            proportion,
                            custom: { h: 3, w: 2, d: 1 },
                            thickness_m,
                            braces_m3: 0.002,
                        });
                        const [main] = plan.volume.chambers;

                        expect(main.difference_ratio).toBeLessThanOrEqual(1e-9);
                        expect(plan.volume.matchesSimulation).toBe(true);
                    }
                }
            }
        }
    });

    test('bandpass: cada câmara fecha com a sua simulação', () => {
        const input = project(
            {
                type: 'bandpass',
                vr_m3: 0.04,
                vf_m3: 0.06,
                fb_hz: 45,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            },
            2,
        );
        const plan = ready(input, { braces_m3: 0.005 });
        const [rear, front] = plan.volume.chambers;

        expect([rear.id, front.id]).toEqual(['rear', 'front']);
        expect(rear.drivers_m3).toBeCloseTo(0.004, 12);
        expect(rear.ports_m3).toBe(0);
        expect(front.drivers_m3).toBe(0);
        expect(front.ports_m3).toBeGreaterThan(0);
        expect(rear.braces_m3 + front.braces_m3).toBeCloseTo(0.005, 12);
        expect(rear.difference_ratio).toBeLessThanOrEqual(1e-9);
        expect(front.difference_ratio).toBeLessThanOrEqual(1e-9);
        expect(plan.volume.matchesSimulation).toBe(true);
    });

    test('sem o volume líquido da simulação não há conferência', () => {
        const input = project();
        const results = { ...simulate(input).results };
        delete results.net_volume_m3;
        const result = buildCutPlan(input, results, resolveCutPlan({}));

        if (result.status !== 'ready') {
            throw new Error('bloqueado');
        }

        expect(result.plan.volume.matchesSimulation).toBeUndefined();
        expect(result.plan.volume.chambers[0].simulated_m3).toBeUndefined();
        expect(warningIds(result.plan)).toContain('simulationUnavailable');
    });

    test('volume líquido adulterado gera volumeMismatch', () => {
        const input = project();
        const results = {
            ...simulate(input).results,
            net_volume_m3: 0.05,
        };
        const result = buildCutPlan(input, results, resolveCutPlan({}));

        if (result.status !== 'ready') {
            throw new Error('bloqueado');
        }

        expect(result.plan.volume.matchesSimulation).toBe(false);
        expect(result.plan.warnings).toContainEqual({
            id: 'volumeMismatch',
            tone: 'error',
        });
    });
});

describe('avisos (C10)', () => {
    test('cutoutTooBig: recorte de 0,7 m não cabe no lado menor da frente', () => {
        const plan = ready(project(), { cutout_m: 0.7 });

        expect(plan.warnings).toContainEqual({
            id: 'cutoutTooBig',
            tone: 'error',
            piece: 'front',
        });
    });

    test('cutoutsDoNotFit: oito drivers de 285 mm numa frente estreita', () => {
        const plan = ready(project({}, 8), { cutout_m: 0.285 });

        expect(plan.warnings).toContainEqual({
            id: 'cutoutsDoNotFit',
            tone: 'error',
            piece: 'front',
        });
        expect(
            plan.pieces[0].cutouts.every(({ center }) => center === undefined),
        ).toBe(true);
    });

    test('cutoutTight: sobra menos que a espessura', () => {
        // Frente externa 441,5 × 691,4 mm; driver de 410 mm deixa 15,75 mm de borda (< 25 mm).
        const plan = ready(project(), { cutout_m: 0.41, thickness_m: 0.025 });

        expect(warningIds(plan)).toContain('cutoutTight');
        expect(warningIds(plan)).not.toContain('cutoutTooBig');
    });

    test('um recorte folgado não avisa', () => {
        const plan = ready(project(), { cutout_m: 0.2 });

        expect(warningIds(plan)).not.toContain('cutoutTight');
        expect(warningIds(plan)).not.toContain('cutoutTooBig');
        expect(warningIds(plan)).not.toContain('cutoutsDoNotFit');
    });

    test('portLongerThanDepth: duto mais longo que a profundidade interna', () => {
        const input = project({
            type: 'vented',
            vb_m3: 0.02,
            fb_hz: 25,
            port: { shape: 'round', diameter_m: 0.05, count: 1 },
        });
        const plan = ready(input);

        expect(plan.port_length_m).toBeGreaterThan(
            plan.dimensions.internal.d_m,
        );
        expect(plan.warnings).toContainEqual({
            id: 'portLongerThanDepth',
            tone: 'warn',
        });
    });

    test('duto que cabe não avisa dobra', () => {
        const plan = ready(
            project({
                type: 'vented',
                fb_hz: 60,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            }),
        );

        expect(plan.port_length_m).toBeLessThan(plan.dimensions.internal.d_m);
        expect(warningIds(plan)).not.toContain('portLongerThanDepth');
    });

    test('driverCutoutUnknown: driver sem diâmetro do recorte', () => {
        expect(ready(project()).warnings).toContainEqual({
            id: 'driverCutoutUnknown',
            tone: 'info',
            key: 'cutout_m',
        });
        expect(warningIds(ready(project(), { cutout_m: 0.2 }))).not.toContain(
            'driverCutoutUnknown',
        );
    });

    test('portUnknown: duto sem medidas', () => {
        const plan = ready(
            project({
                type: 'vented',
                fb_hz: 32,
                port: { shape: 'rect', width_m: 0.05, count: 1 },
            }),
        );

        expect(warningIds(plan)).toContain('portUnknown');
        expect(warningIds(plan)).toContain('simulationUnavailable');
        expect(plan.volume.chambers).toEqual([]);
    });

    test('um plano sem avisos de recorte nem de simulação fecha limpo', () => {
        const plan = ready(project(), { cutout_m: 0.2 });

        expect(plan.warnings).toEqual([]);
    });
});

describe('bandpass (C6)', () => {
    const bandpass = (count = 1, port: Partial<BoxInput['port']> = {}) =>
        project(
            {
                type: 'bandpass',
                vr_m3: 0.04,
                vf_m3: 0.06,
                fb_hz: 45,
                port: { shape: 'round', diameter_m: 0.1, count: 1, ...port },
            },
            count,
        );

    test('C6 — 40 + 60 L, áurea, 18 mm: dimensões e profundidade por câmara', () => {
        const { dimensions } = ready(bandpass());

        expect(dimensions.internal.w_m * 1000).toBeCloseTo(464.2, 0);
        expect(dimensions.internal.h_m * 1000).toBeCloseTo(751.0, 0);
        expect(dimensions.internal.d_m * 1000).toBeCloseTo(286.9, 0);
        expect((dimensions.chambers?.rear_d_m ?? 0) * 1000).toBeCloseTo(
            114.7,
            0,
        );
        expect((dimensions.chambers?.front_d_m ?? 0) * 1000).toBeCloseTo(
            172.1,
            0,
        );
        expect(
            (dimensions.chambers?.rear_d_m ?? 0) +
                (dimensions.chambers?.front_d_m ?? 0),
        ).toBeCloseTo(dimensions.internal.d_m, 12);
        // frente, fundo e divisória: D + 3t
        expect(dimensions.external.d_m).toBeCloseTo(
            dimensions.internal.d_m + 3 * 0.018,
            12,
        );
        expect(dimensions.external.d_m * 1000).toBeCloseTo(340.9, 0);
    });

    test('cada câmara guarda o seu volume mais a parte dos reforços', () => {
        for (const braces_m3 of [0, 0.004]) {
            const { dimensions } = ready(bandpass(), { braces_m3 });
            const area = dimensions.internal.w_m * dimensions.internal.h_m;
            const beta = braces_m3 / 0.1;

            expect(area * (dimensions.chambers?.rear_d_m ?? 0)).toBeCloseTo(
                0.04 * (1 + beta),
                12,
            );
            expect(area * (dimensions.chambers?.front_d_m ?? 0)).toBeCloseTo(
                0.06 * (1 + beta),
                12,
            );
        }
    });

    test('C8 — sete peças em seis linhas, divisória W × H', () => {
        const plan = ready(bandpass());
        const divider = plan.pieces.find((piece) => piece.role === 'divider');

        expect(plan.pieces).toHaveLength(6);
        expect(plan.pieces.reduce((sum, p) => sum + p.quantity, 0)).toBe(7);
        expect(divider).toMatchObject({
            quantity: 1,
            w_m: plan.dimensions.internal.w_m,
            h_m: plan.dimensions.internal.h_m,
            thickness_m: plan.thickness_m,
        });
    });

    test('C7 — a profundidade entre frente e fundo é traseira + divisória + frontal', () => {
        const plan = ready(bandpass());
        const top = plan.pieces.find((piece) => piece.role === 'top');
        const { chambers } = plan.dimensions;

        expect(top?.h_m).toBeCloseTo(
            (chambers?.rear_d_m ?? 0) +
                plan.thickness_m +
                (chambers?.front_d_m ?? 0),
            12,
        );
    });

    test('driver(s) na divisória e duto(s) na frente, cada um sozinho', () => {
        const plan = ready(bandpass(2, { count: 2 }), { cutout_m: 0.2 });
        const front = plan.pieces.find((piece) => piece.role === 'front');
        const divider = plan.pieces.find((piece) => piece.role === 'divider');

        expect(front?.cutouts.map(({ kind }) => kind)).toEqual([
            'port',
            'port',
        ]);
        expect(divider?.cutouts.map(({ kind }) => kind)).toEqual([
            'driver',
            'driver',
        ]);
        expect(
            divider?.cutouts.every(({ center }) => center !== undefined),
        ).toBe(true);
    });

    test('conferência com duas câmaras: drivers atrás, duto na frente, líquidos conferem', () => {
        const input = bandpass(2);
        const plan = ready(input, { braces_m3: 0.005 });
        const results = simulate(input).results;
        const [rear, front] = plan.volume.chambers;

        expect([rear.id, front.id]).toEqual(['rear', 'front']);
        expect(rear.drivers_m3).toBeGreaterThan(0);
        expect(front.drivers_m3).toBe(0);
        expect(rear.ports_m3).toBe(0);
        expect(front.ports_m3).toBeGreaterThan(0);
        expect(rear.net_m3).toBeCloseTo(results.net_rear_m3 as number, 9);
        expect(front.net_m3).toBeCloseTo(results.net_front_m3 as number, 9);
        expect(plan.volume.matchesSimulation).toBe(true);
    });

    test('bloqueada sem Vr, sem Vf ou sem os dois', () => {
        const { vr_m3: _vr, ...withoutRear } = bandpass().box;
        const { vf_m3: _vf, ...withoutFront } = bandpass().box;
        const { vf_m3: _f, vr_m3: _r, ...withoutBoth } = bandpass().box;

        expect(build({ ...bandpass(), box: withoutRear })).toMatchObject({
            status: 'blocked',
            missing: ['vr_m3'],
        });
        expect(build({ ...bandpass(), box: withoutFront })).toMatchObject({
            status: 'blocked',
            missing: ['vf_m3'],
        });
        expect(build({ ...bandpass(), box: withoutBoth })).toMatchObject({
            status: 'blocked',
            missing: ['vr_m3', 'vf_m3'],
        });
    });

    test('o aviso de duto longo compara com a câmara frontal', () => {
        const input = project({
            type: 'bandpass',
            vr_m3: 0.04,
            vf_m3: 0.01,
            fb_hz: 40,
            port: { shape: 'round', diameter_m: 0.05, count: 1 },
        });
        const plan = ready(input);

        expect(plan.port_length_m).toBeGreaterThan(
            plan.dimensions.chambers?.front_d_m ?? 0,
        );
        expect(plan.warnings).toContainEqual({
            id: 'portLongerThanDepth',
            tone: 'warn',
        });
    });
});

describe('bandpass de 6ª ordem', () => {
    const sixth = (box: Partial<BoxInput> = {}, count = 1): ProjectInput =>
        project(
            {
                type: 'bandpass6',
                vr_m3: 0.08,
                vf_m3: 0.04,
                fb_hz: 45,
                fb_rear_hz: 30,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
                port_rear: { shape: 'round', diameter_m: 0.08, count: 1 },
                ...box,
            },
            count,
        );

    const piece = (plan: Plan, role: string) =>
        plan.pieces.find((item) => item.role === role);

    test('as mesmas sete peças da 4ª ordem, com a divisória e as profundidades por câmara', () => {
        const plan = ready(sixth());
        const four = ready(
            project({
                type: 'bandpass',
                vr_m3: 0.08,
                vf_m3: 0.04,
                fb_hz: 45,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            }),
        );

        expect(plan.boxType).toBe('bandpass6');
        expect(plan.pieces.map(({ role }) => role)).toEqual(
            four.pieces.map(({ role }) => role),
        );
        expect(plan.pieces.reduce((sum, p) => sum + p.quantity, 0)).toBe(7);
        expect(plan.dimensions.chambers?.rear_d_m).toBeCloseTo(
            2 * (plan.dimensions.chambers?.front_d_m ?? 0),
            9,
        );
    });

    test('duto frontal na frente, duto traseiro no fundo e driver na divisória', () => {
        const plan = ready(sixth(), { cutout_m: 0.2 });

        expect(piece(plan, 'front')?.cutouts).toMatchObject([
            { kind: 'port', shape: 'round', diameter_m: 0.1 },
        ]);
        expect(piece(plan, 'back')?.cutouts).toMatchObject([
            { kind: 'port', shape: 'round', diameter_m: 0.08 },
        ]);
        expect(piece(plan, 'divider')?.cutouts.map(({ kind }) => kind)).toEqual(
            ['driver'],
        );
        expect(
            piece(plan, 'back')?.cutouts.every(
                ({ center }) => center !== undefined,
            ),
        ).toBe(true);
    });

    test('cada duto segue o seu formato, medidas e quantidade', () => {
        const plan = ready(
            sixth({
                port: {
                    shape: 'rect',
                    width_m: 0.12,
                    height_m: 0.05,
                    count: 2,
                },
                port_rear: {
                    shape: 'triangle',
                    base_m: 0.1,
                    height_m: 0.08,
                    count: 3,
                },
            }),
        );

        const front = piece(plan, 'front')?.cutouts ?? [];
        const back = piece(plan, 'back')?.cutouts ?? [];

        expect(front).toHaveLength(2);
        expect(front.every(({ shape }) => shape === 'rect')).toBe(true);
        expect(back).toHaveLength(3);
        expect(back.every(({ shape }) => shape === 'triangle')).toBe(true);
        expect(back[0]).toMatchObject({ base_m: 0.1, height_m: 0.08 });
    });

    test('conferência por câmara dentro de 2 % da simulação, com o duto de cada uma', () => {
        const input = sixth({}, 2);
        const plan = ready(input, { braces_m3: 0.005 });
        const results = simulate(input).results;
        const [rear, front] = plan.volume.chambers;
        const area = (diameter: number) => (Math.PI * diameter ** 2) / 4;

        expect([rear.id, front.id]).toEqual(['rear', 'front']);
        expect(rear.ports_m3).toBeCloseTo(
            area(0.08) * (results.port_rear_length_m as number),
            12,
        );
        expect(front.ports_m3).toBeCloseTo(
            area(0.1) * (results.port_length_m as number),
            12,
        );
        expect(rear.drivers_m3).toBeGreaterThan(0);
        expect(front.drivers_m3).toBe(0);
        expect(rear.difference_ratio).toBeLessThanOrEqual(0.02);
        expect(front.difference_ratio).toBeLessThanOrEqual(0.02);
        expect(rear.net_m3).toBeCloseTo(results.net_rear_m3 as number, 9);
        expect(front.net_m3).toBeCloseTo(results.net_front_m3 as number, 9);
        expect(plan.volume.matchesSimulation).toBe(true);
        expect(plan.port_rear_length_m).toBe(results.port_rear_length_m);
    });

    test('duto mais longo que a câmara avisa só o duto em questão', () => {
        const plan = ready(
            sixth({
                vr_m3: 0.02,
                fb_rear_hz: 20,
                port: { shape: 'round', diameter_m: 0.06, count: 1 },
                port_rear: { shape: 'round', diameter_m: 0.02, count: 1 },
            }),
        );
        const warnings = plan.warnings.filter(
            ({ id }) => id === 'portLongerThanDepth',
        );

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatchObject({ duct: 'rear' });
        expect(warnings[0].length_m).toBeGreaterThan(
            warnings[0].depth_m as number,
        );
        expect(warnings[0].depth_m).toBeCloseTo(
            plan.dimensions.chambers?.rear_d_m ?? 0,
            12,
        );
    });

    test('duto sem medidas: recorte pendente, aviso nomeando o duto e sem conferência de volume', () => {
        const plan = ready(sixth({ port_rear: { shape: 'round', count: 1 } }));

        expect(piece(plan, 'back')?.cutouts[0].pending).toEqual(['diameter_m']);
        expect(
            plan.warnings.filter(({ id }) => id === 'portUnknown'),
        ).toMatchObject([{ duct: 'rear' }]);
        expect(plan.volume.chambers).toEqual([]);
    });

    test('sem o duto traseiro definido o plano ainda sai, com o aviso do duto', () => {
        const input = sixth();
        delete input.box.port_rear;
        const plan = ready(input);

        expect(piece(plan, 'back')?.cutouts).toHaveLength(1);
        expect(
            plan.warnings.filter(({ id }) => id === 'portUnknown'),
        ).toMatchObject([{ duct: 'rear' }]);
    });

    test('bloqueada sem Vr ou sem Vf, nomeando o que falta', () => {
        const { vr_m3: _vr, ...withoutRear } = sixth().box;
        const { vf_m3: _vf, ...withoutFront } = sixth().box;

        expect(build({ ...sixth(), box: withoutRear })).toMatchObject({
            status: 'blocked',
            missing: ['vr_m3'],
        });
        expect(build({ ...sixth(), box: withoutFront })).toMatchObject({
            status: 'blocked',
            missing: ['vf_m3'],
        });
    });

    test('a 4ª ordem não muda: fundo sem recortes e avisos sem duto', () => {
        const plan = ready(
            project({
                type: 'bandpass',
                vr_m3: 0.04,
                vf_m3: 0.06,
                fb_hz: 45,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            }),
        );

        expect(piece(plan, 'back')?.cutouts).toEqual([]);
        expect(plan.port_rear_length_m).toBeUndefined();
        expect(plan.warnings.every(({ duct }) => duct === undefined)).toBe(
            true,
        );
    });
});

describe('medidas do alto-falante no plano', () => {
    const body = (
        b: DriverBody,
        config: CutPlanConfig = { cutout_m: 0.25 },
    ) => {
        const input = project();
        const result = buildCutPlan(
            input,
            simulate(input).results,
            resolveCutPlan(config),
            b,
        );

        if (result.status !== 'ready') {
            throw new Error('bloqueado');
        }

        return result.plan;
    };
    const driverCutout = (plan: Plan) =>
        plan.pieces
            .find((piece) => piece.role === 'front')
            ?.cutouts.find((cutout) => cutout.kind === 'driver');

    test('redondo é o padrão: diâmetro C', () => {
        expect(driverCutout(body({}))).toMatchObject({
            shape: 'round',
            diameter_m: 0.25,
        });
    });

    test('quadrado usa C nos dois lados', () => {
        expect(driverCutout(body({ shape: 'square' }))).toMatchObject({
            shape: 'rect',
            width_m: 0.25,
            height_m: 0.25,
        });
    });

    test('retangular usa C × D e, sem D, deixa o recorte a informar', () => {
        expect(driverCutout(body({ shape: 'rect', d_m: 0.18 }))).toMatchObject({
            shape: 'rect',
            width_m: 0.25,
            height_m: 0.18,
        });
        expect(driverCutout(body({ shape: 'rect' }))?.pending).toEqual([
            'drv_d_m',
        ]);
    });

    test('alto-falante mais fundo que a câmara gera aviso; um que cabe, não', () => {
        const deep = body({ depth_m: 5 });
        const fits = body({ depth_m: 0.05 });

        expect(deep.warnings.map((w) => w.id)).toContain('driverTooDeep');
        expect(fits.warnings.map((w) => w.id)).not.toContain('driverTooDeep');
    });
});

describe('posição manual dos recortes', () => {
    const vented = project({ type: 'vented', vb_m3: 0.1, fb_hz: 35 }, 2);
    const front = (plan: Plan) =>
        plan.pieces.find((piece) => piece.role === 'front');

    test('sem posições o plano é o mesmo e todo recorte ganha a identidade', () => {
        const panel = front(ready(vented, { cutout_m: 0.2 }));

        expect(panel?.cutouts.map(({ ref }) => ref)).toEqual([
            { piece: 'front', kind: 'driver', n: 1 },
            { piece: 'front', kind: 'driver', n: 2 },
            { piece: 'front', kind: 'port', n: 1 },
        ]);
        expect(panel?.cutouts.some(({ manual }) => manual)).toBe(false);
    });

    test('o recorte manual usa o centro gravado e os demais refazem a fila só entre eles', () => {
        const auto = front(ready(vented, { cutout_m: 0.2 }));
        const panel = front(
            ready(vented, {
                cutout_m: 0.2,
                positions: [
                    {
                        piece: 'front',
                        kind: 'port',
                        n: 1,
                        x_m: 0.12,
                        y_m: 0.11,
                    },
                ],
            }),
        );
        const port = panel?.cutouts[2];

        expect(port).toMatchObject({
            manual: true,
            center: { x_m: 0.12, y_m: 0.11 },
        });
        expect(panel?.cutouts[0].center).not.toEqual(auto?.cutouts[0].center);
        expect(panel?.w_m).toBe(auto?.w_m);
    });

    test('posição de outra peça ou de recorte que não existe é ignorada', () => {
        const auto = front(ready(vented, { cutout_m: 0.2 }));
        const panel = front(
            ready(vented, {
                cutout_m: 0.2,
                positions: [
                    { piece: 'back', kind: 'driver', n: 1, x_m: 0.1, y_m: 0.1 },
                    {
                        piece: 'front',
                        kind: 'driver',
                        n: 5,
                        x_m: 0.1,
                        y_m: 0.1,
                    },
                ],
            }),
        );

        expect(panel?.cutouts).toEqual(auto?.cutouts);
    });

    test('recorte sem medida não usa a posição gravada', () => {
        const panel = front(
            ready(project(), {
                positions: [
                    {
                        piece: 'front',
                        kind: 'driver',
                        n: 1,
                        x_m: 0.1,
                        y_m: 0.1,
                    },
                ],
            }),
        );

        expect(panel?.cutouts[0].manual).toBeUndefined();
        expect(panel?.cutouts[0].center).toBeUndefined();
    });

    test('avisos de sobreposição, faixa de colagem e fora da peça trazem a peça e o recorte', () => {
        const plan = ready(project({}, 2), {
            cutout_m: 0.2,
            positions: [
                { piece: 'front', kind: 'driver', n: 1, x_m: 0.05, y_m: 0.2 },
            ],
        });
        const warnings = plan.warnings.filter(
            ({ cutout }) => cutout !== undefined,
        );

        expect(warnings).toContainEqual({
            id: 'cutoutOutside',
            tone: 'error',
            piece: 'front',
            cutout: { piece: 'front', kind: 'driver', n: 1 },
        });
        expect(warnings.some(({ id }) => id === 'cutoutInGlueBand')).toBe(
            false,
        );
    });

    test('a posição manual não muda volumes nem medidas da caixa', () => {
        const auto = ready(vented, { cutout_m: 0.2 });
        const moved = ready(vented, {
            cutout_m: 0.2,
            positions: [
                { piece: 'front', kind: 'driver', n: 1, x_m: 0.2, y_m: 0.2 },
            ],
        });

        expect(moved.dimensions).toEqual(auto.dimensions);
        expect(moved.volume).toEqual(auto.volume);
    });
});
