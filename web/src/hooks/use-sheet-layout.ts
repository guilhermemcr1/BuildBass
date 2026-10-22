import { useMemo } from 'react';
import { nestPieces, resolveCutPlan } from '@/cutplan';
import type { Plan, ResolvedSheet, SheetLayout } from '@/cutplan';
import { useActiveProject } from '@/hooks/use-active-project';

export type SheetSuggestion = { sheet: ResolvedSheet; layout: SheetLayout };

// Sugestão de corte da chapa do usuário para o plano pronto (specs/008). Sem chapa completa não há
// sugestão. Recalcula só quando o plano ou a chapa mudam.
export function useSheetLayout(
    plan: Plan | undefined,
): SheetSuggestion | undefined {
    const config = useActiveProject((state) => state.data.cutPlan);
    const sheet = resolveCutPlan(config).sheet;
    const { w_m, h_m, kerf_m, rotate } = sheet ?? {};

    return useMemo(() => {
        if (
            plan === undefined ||
            w_m === undefined ||
            h_m === undefined ||
            kerf_m === undefined ||
            rotate === undefined
        ) {
            return undefined;
        }

        const resolved: ResolvedSheet = { w_m, h_m, kerf_m, rotate };

        return { sheet: resolved, layout: nestPieces(plan.pieces, resolved) };
    }, [plan, w_m, h_m, kerf_m, rotate]);
}
