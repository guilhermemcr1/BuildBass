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

// Histórico de desfazer do projeto ativo (50 passos por projeto, só na sessão).
export function useActiveHistory() {
    const activeId = useWorkspace((state) => state.activeId);
    const { temporal } = projectStore(activeId);
    const canUndo = useStore(temporal, (state) => state.pastStates.length > 0);
    const canRedo = useStore(
        temporal,
        (state) => state.futureStates.length > 0,
    );

    return {
        canUndo,
        canRedo,
        undo: () => temporal.getState().undo(),
        redo: () => temporal.getState().redo(),
    };
}
