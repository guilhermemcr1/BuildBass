import { useMemo } from 'react';
import { nestPieces, resolveCutPlan } from '@/cutplan';
import type { Plan, ResolvedSheet, SheetLayout } from '@/cutplan';
import { useActiveProject } from '@/hooks/use-active-project';

export type SheetSuggestion = { sheet: ResolvedSheet; layout: SheetLayout };

// Sugestão de corte do estoque de chapas do usuário para o plano pronto (specs/008 e 012). Sem um
// item completo no estoque não há sugestão. Recalcula só quando o plano ou o estoque mudam: o
// resolvido é um objeto novo a cada render, então a dependência é a forma serializada.
export function useSheetLayout(
    plan: Plan | undefined,
): SheetSuggestion | undefined {
    const config = useActiveProject((state) => state.data.cutPlan);
    const sheet = resolveCutPlan(config).sheet;
    const key = sheet === undefined ? '' : JSON.stringify(sheet);

    return useMemo(() => {
        if (plan === undefined || key === '') {
            return undefined;
        }

        const resolved = JSON.parse(key) as ResolvedSheet;

        return { sheet: resolved, layout: nestPieces(plan.pieces, resolved) };
    }, [plan, key]);
}
