// API pública do plano de corte (specs/005, contracts/cutplan.md). A interface só calcula
// dimensões, volumes e projeções por aqui.
export {
    CUT_PLAN_LIMITS,
    DEFAULT_THICKNESS_M,
    PROPORTIONS,
    resolveCutPlan,
    validateCutPlan,
    validateResolved,
} from './config';
export type * from './types';
export { layoutRow } from './layout';
export { buildCutPlan } from './plan';
export { DEFAULT_VIEW, dimensionLines, projectBox } from './projection';
export type { DimensionLine, Polygon, View } from './projection';
export { cutPlanCsv } from './csv';
export type { CsvFormat, CsvLabels } from './csv';
