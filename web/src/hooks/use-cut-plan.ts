import { resolveCutPlan, buildCutPlan } from '@/cutplan';
import type { CutPlan, DriverBody } from '@/cutplan';
import type { ProjectData } from '@/lib/project/types';
import { useWorkspace } from '@/stores/workspace';
import { simulationOf } from './use-simulation';

// O que o plano usa das medidas do alto-falante: formato, segundo lado e profundidade atrás do
// painel (G − F, o aro fica na frente).
export function driverBodyOf(data: ProjectData): DriverBody {
    const dims = data.driverDims;

    return {
        ...(dims?.shape === undefined ? {} : { shape: dims.shape }),
        ...(dims?.d_m === undefined ? {} : { d_m: dims.d_m }),
        ...(dims?.g_m === undefined
            ? {}
            : { depth_m: Math.max(0, dims.g_m - (dims.f_m ?? 0)) }),
    };
}

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
        driverBodyOf(data),
    );
    cache.set(data, plan);

    return plan;
}

// Plano de corte do projeto ativo.
export function useCutPlan(): CutPlan {
    const data = useWorkspace(
        (state) => state.projects.find((p) => p.id === state.activeId)?.data,
    );

    return cutPlanOf(data ?? useWorkspace.getState().projects[0].data);
}
