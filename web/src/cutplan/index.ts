// API pública do plano de corte. A interface só calcula
// dimensões, volumes e projeções por aqui.
export {
    CUT_PLAN_LIMITS,
    DEFAULT_KERF_M,
    DEFAULT_THICKNESS_M,
    PROPORTIONS,
    resolveCutPlan,
    validateCutPlan,
    validateResolved,
} from './config';
export type * from './types';
export {
    checkCutouts,
    cutoutExtent,
    layoutRow,
    svgTriangle,
    trianglePoints,
} from './layout';
export { MAX_STOCK_ITEMS, stockItems, stockOf, withStock } from './stock';
export { buildCutPlan } from './plan';
export { DEFAULT_VIEW, dimensionLines, projectBox } from './projection';
export type { DimensionLine, Polygon, View } from './projection';
export { cutPlanCsv } from './csv';
export type { CsvFormat, CsvLabels } from './csv';
export { nestPieces } from './nesting';
export type { Sheet, SheetLayout } from './nesting';
export { cutTotals } from './totals';
export type { Basis, CutTotals } from './totals';
