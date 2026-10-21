import { resolveCutPlan, buildCutPlan } from '@/cutplan';
import type { CutPlan } from '@/cutplan';
import type { ProjectData } from '@/lib/project/types';
import { useWorkspace } from '@/stores/workspace';
import { simulationOf } from './use-simulation';

// Um plano por versão dos dados: o mesmo objeto `data` nunca é calculado duas vezes.
const cache = new WeakMap<ProjectData, CutPlan>();

export function cutPlanOf(data: ProjectData): CutPlan {
    const cached = cache.get(data);

    if (cached !== undefined) {
        return cached;
    }

    const plan = buildCutPlan(
        data,
        simulationOf(data).results,
        resolveCutPlan(data.cutPlan),
    );
    cache.set(data, plan);

    return plan;
}

// Plano de corte do projeto ativo (specs/005).
export function useCutPlan(): CutPlan {
    const data = useWorkspace(
        (state) => state.projects.find((p) => p.id === state.activeId)?.data,
    );

    return cutPlanOf(data ?? useWorkspace.getState().projects[0].data);
}
