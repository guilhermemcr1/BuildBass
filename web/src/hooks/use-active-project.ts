import { useStore } from 'zustand';
import type { ProjectState } from '@/stores/project-store';
import { projectStore, useWorkspace } from '@/stores/workspace';

// Lê o projeto ativo (a aba selecionada) e reage à troca de aba.
export function useActiveProject<T>(selector: (state: ProjectState) => T): T {
    const activeId = useWorkspace((state) => state.activeId);

    return useStore(projectStore(activeId), selector);
}

export function activeProjectStore() {
    return projectStore(useWorkspace.getState().activeId);
}
