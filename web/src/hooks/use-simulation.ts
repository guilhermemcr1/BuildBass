import { simulate } from '@/engine';
import type { Simulation } from '@/engine';
import type { ProjectData } from '@/lib/project/types';
import { useWorkspace } from '@/stores/workspace';
import type { OpenProject } from '@/stores/workspace';

// Um resultado por versão dos dados: o mesmo objeto `data` nunca é simulado duas vezes.
const cache = new WeakMap<ProjectData, Simulation>();

export function simulationOf(data: ProjectData): Simulation {
    const cached = cache.get(data);

    if (cached !== undefined) {
        return cached;
    }

    const result = simulate(data);
    cache.set(data, result);

    return result;
}

export type ProjectSimulation = {
    project: OpenProject;
    active: boolean;
    simulation: Simulation;
};

// Projetos que aparecem no gráfico: os com "mostrar no gráfico" ligado, o ativo primeiro.
export function useSimulations(): ProjectSimulation[] {
    const projects = useWorkspace((state) => state.projects);
    const activeId = useWorkspace((state) => state.activeId);

    return projects
        .filter((project) => project.plotted)
        .map((project) => ({
            project,
            active: project.id === activeId,
            simulation: simulationOf(project.data),
        }))
        .sort((a, b) => Number(b.active) - Number(a.active));
}

export function useActiveSimulation(): Simulation {
    const data = useWorkspace(
        (state) => state.projects.find((p) => p.id === state.activeId)?.data,
    );

    return simulationOf(data ?? useWorkspace.getState().projects[0].data);
}
