import type {
    CutPlanConfig,
    CutPlanProportion,
    PlanKey,
    Ratio,
    ResolvedCutPlanConfig,
} from './types';

// Limites (SI) usados pelo esquema do arquivo, pelos campos da bancada e pela validação
// (specs/005, data-model.md §1).
export const CUT_PLAN_LIMITS = {
    thickness_m: { min: 0.006, max: 0.05 },
    braces_m3: { min: 0, max: 20 },
    cutout_m: { min: 0.03, max: 1 },
    ratio: { min: 0.1, max: 10 },
} as const;

// Painel de MDF comum (research.md §2).
export const DEFAULT_THICKNESS_M = 0.018;

const GOLDEN = (1 + Math.sqrt(5)) / 2; // [MAT]

// Sugestões de proporção altura : largura : profundidade (research.md §3). A profundidade fica com
// o menor valor porque o painel frontal leva o recorte do driver e precisa dos dois lados maiores.
// São convenções para não repetir dimensões, não prova acústica:
// - golden: φ² : φ : 1, construção popular de "caixa áurea" em projetos DIY [AU], definição em [MAT];
// - louden: 1,9 : 1,4 : 1, razão de salas retangulares de Louden (1971) [L71], usada aqui por
//   analogia (a fonte trata de modos de salas, não de caixas);
// - equalSteps: 2^(2/3) : 2^(1/3) : 1, passos iguais sem múltiplos inteiros [MAT];
// - cube: lados iguais.
export const PROPORTIONS: Record<
    Exclude<CutPlanProportion, 'custom'>,
    Ratio
> = {
    golden: { h: GOLDEN ** 2, w: GOLDEN, d: 1 },
    louden: { h: 1.9, w: 1.4, d: 1 },
    equalSteps: { h: 2 ** (2 / 3), w: 2 ** (1 / 3), d: 1 },
    cube: { h: 1, w: 1, d: 1 },
};

export function resolveCutPlan(
    config: CutPlanConfig = {},
): ResolvedCutPlanConfig {
    const proportion = config.proportion ?? 'golden';
    const ratio =
        proportion === 'custom'
            ? (config.custom ?? PROPORTIONS.cube)
            : PROPORTIONS[proportion];

    return {
        thickness_m: config.thickness_m ?? DEFAULT_THICKNESS_M,
        proportion,
        ratio: { ...ratio },
        braces_m3: config.braces_m3 ?? 0,
        ...(config.cutout_m === undefined ? {} : { cutout_m: config.cutout_m }),
    };
}

function within(value: number, limit: { min: number; max: number }): boolean {
    return Number.isFinite(value) && value >= limit.min && value <= limit.max;
}

// Chaves com valor fora da faixa, na ordem espessura, razão, reforços, recorte. Só a razão efetiva
// conta: `custom` é ignorado quando a proporção é uma sugestão.
export function validateCutPlan(config?: CutPlanConfig): PlanKey[] {
    const resolved = resolveCutPlan(config);
    const { ratio } = resolved;
    const invalid: PlanKey[] = [];

    if (!within(resolved.thickness_m, CUT_PLAN_LIMITS.thickness_m)) {
        invalid.push('thickness_m');
    }

    if (
        ![ratio.h, ratio.w, ratio.d].every((side) =>
            within(side, CUT_PLAN_LIMITS.ratio),
        )
    ) {
        invalid.push('ratio');
    }

    if (!within(resolved.braces_m3, CUT_PLAN_LIMITS.braces_m3)) {
        invalid.push('braces_m3');
    }

    if (
        resolved.cutout_m !== undefined &&
        !within(resolved.cutout_m, CUT_PLAN_LIMITS.cutout_m)
    ) {
        invalid.push('cutout_m');
    }

    return invalid;
}
