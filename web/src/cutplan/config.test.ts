import { describe, expect, test } from 'vite-plus/test';
import {
    CUT_PLAN_LIMITS,
    PROPORTIONS,
    resolveCutPlan,
    validateCutPlan,
} from './config';

const PHI = (1 + Math.sqrt(5)) / 2;

describe('resolveCutPlan', () => {
    test('sem configuração: espessura de 18 mm, proporção áurea, sem reforços e sem recorte', () => {
        const config = resolveCutPlan();

        expect(config.thickness_m).toBe(0.018);
        expect(config.proportion).toBe('golden');
        expect(config.ratio.h).toBeCloseTo(PHI ** 2, 12);
        expect(config.ratio.w).toBeCloseTo(PHI, 12);
        expect(config.ratio.d).toBe(1);
        expect(config.braces_m3).toBe(0);
        expect(config.cutout_m).toBeUndefined();
        expect(resolveCutPlan({})).toEqual(config);
    });

    test('as sugestões de proporção seguem a pesquisa (profundidade é o menor valor)', () => {
        expect(PROPORTIONS.louden).toEqual({ h: 1.9, w: 1.4, d: 1 });
        expect(PROPORTIONS.cube).toEqual({ h: 1, w: 1, d: 1 });
        expect(PROPORTIONS.equalSteps.h).toBeCloseTo(2 ** (2 / 3), 12);
        expect(PROPORTIONS.equalSteps.w).toBeCloseTo(2 ** (1 / 3), 12);
        expect(PROPORTIONS.equalSteps.d).toBe(1);
        expect(PROPORTIONS.golden.h).toBeCloseTo(PHI ** 2, 12);
    });

    test('cada sugestão vira a razão da configuração resolvida', () => {
        for (const id of ['golden', 'louden', 'equalSteps', 'cube'] as const) {
            expect(resolveCutPlan({ proportion: id }).ratio).toEqual(
                PROPORTIONS[id],
            );
        }
    });

    test('proporção própria usa custom e, sem ele, 1 : 1 : 1', () => {
        expect(
            resolveCutPlan({
                proportion: 'custom',
                custom: { h: 2.2, w: 1.5, d: 1 },
            }).ratio,
        ).toEqual({ h: 2.2, w: 1.5, d: 1 });
        expect(resolveCutPlan({ proportion: 'custom' }).ratio).toEqual({
            h: 1,
            w: 1,
            d: 1,
        });
    });

    test('custom é ignorado quando a proporção não é custom', () => {
        const config = resolveCutPlan({
            proportion: 'cube',
            custom: { h: 3, w: 2, d: 1 },
        });

        expect(config.ratio).toEqual({ h: 1, w: 1, d: 1 });
    });

    test('mantém os valores informados', () => {
        const config = resolveCutPlan({
            thickness_m: 0.025,
            braces_m3: 0.002,
            cutout_m: 0.285,
        });

        expect(config).toMatchObject({
            thickness_m: 0.025,
            braces_m3: 0.002,
            cutout_m: 0.285,
        });
    });
});

describe('validateCutPlan', () => {
    test('configuração válida e ausente não têm chaves inválidas', () => {
        expect(validateCutPlan()).toEqual([]);
        expect(
            validateCutPlan({
                thickness_m: 0.018,
                braces_m3: 0,
                cutout_m: 0.285,
            }),
        ).toEqual([]);
    });

    test('limites exatos são válidos', () => {
        const { thickness_m, braces_m3, cutout_m, ratio } = CUT_PLAN_LIMITS;

        for (const limit of ['min', 'max'] as const) {
            expect(
                validateCutPlan({
                    thickness_m: thickness_m[limit],
                    braces_m3: braces_m3[limit],
                    cutout_m: cutout_m[limit],
                    proportion: 'custom',
                    custom: {
                        h: ratio[limit],
                        w: ratio[limit],
                        d: ratio[limit],
                    },
                }),
            ).toEqual([]);
        }
    });

    test.each([
        ['espessura abaixo', { thickness_m: 0.005 }, 'thickness_m'],
        ['espessura acima', { thickness_m: 0.051 }, 'thickness_m'],
        ['espessura zero', { thickness_m: 0 }, 'thickness_m'],
        ['reforços negativos', { braces_m3: -0.001 }, 'braces_m3'],
        ['reforços acima', { braces_m3: 21 }, 'braces_m3'],
        ['recorte abaixo', { cutout_m: 0.02 }, 'cutout_m'],
        ['recorte acima', { cutout_m: 1.01 }, 'cutout_m'],
        ['NaN', { thickness_m: Number.NaN }, 'thickness_m'],
        ['infinito', { braces_m3: Number.POSITIVE_INFINITY }, 'braces_m3'],
    ] as const)('%s', (_name, config, key) => {
        expect(validateCutPlan(config)).toEqual([key]);
    });

    test('razão própria com algum lado fora de 0,1…10 aponta ratio', () => {
        for (const custom of [
            { h: 0, w: 1, d: 1 },
            { h: 1, w: 0.09, d: 1 },
            { h: 1, w: 1, d: 11 },
            { h: -1, w: 1, d: 1 },
        ]) {
            expect(validateCutPlan({ proportion: 'custom', custom })).toEqual([
                'ratio',
            ]);
        }
    });

    test('custom inválido é ignorado quando a proporção é uma sugestão', () => {
        expect(
            validateCutPlan({
                proportion: 'golden',
                custom: { h: 0, w: 0, d: 0 },
            }),
        ).toEqual([]);
    });

    test('várias chaves inválidas saem na ordem espessura, razão, reforços, recorte', () => {
        expect(
            validateCutPlan({
                cutout_m: 5,
                braces_m3: -1,
                proportion: 'custom',
                custom: { h: 0, w: 1, d: 1 },
                thickness_m: 0,
            }),
        ).toEqual(['thickness_m', 'ratio', 'braces_m3', 'cutout_m']);
    });
});
