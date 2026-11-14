import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
    SERIES_COLORS,
    createProjectData,
    validColor,
} from '@/lib/project/types';
import type { ProjectData, SeriesColor } from '@/lib/project/types';
import { createProjectStore } from './project-store';
import type { ProjectStore } from './project-store';
import { createSafeStorage, usePreferences } from './preferences';

// Até 3 projetos abertos em abas, salvos no navegador (spec 002, US7; data-model.md).

export const WORKSPACE_KEY = 'buildbass.workspace';
export const MAX_OPEN_PROJECTS = 3;

export type Slot = 1 | 2 | 3;

export type { SeriesColor };

export type OpenProject = {
    id: string;
    // Só numera o nome padrão ("Projeto sem nome 2"); a cor é `color`.
    slot: Slot;
    color: SeriesColor;
    data: ProjectData;
    plotted: boolean;
    unsaved: boolean;
};

type OpenResult = 'ok' | 'limit';

type WorkspaceState = {
    projects: OpenProject[];
    activeId: string;
    storageAvailable: boolean;
    newProject: () => OpenResult;
    openProject: (data: ProjectData, color?: SeriesColor) => OpenResult;
    closeProject: (id: string) => void;
    setActive: (id: string) => void;
    setColor: (id: string, color: SeriesColor) => void;
    togglePlotted: (id: string) => void;
    markExported: (id: string) => void;
};

const SLOTS: Slot[] = [1, 2, 3];

function freeSlot(projects: OpenProject[]): Slot {
    return SLOTS.find((slot) => projects.every((p) => p.slot !== slot)) ?? 1;
}

// Menor cor livre; com todas em uso (impossível com 3 abas e 6 cores), a primeira.
function freeColor(projects: OpenProject[]): SeriesColor {
    return (
        SERIES_COLORS.find((color) =>
            projects.every((p) => p.color !== color),
        ) ?? 1
    );
}

function openEntry(
    projects: OpenProject[],
    data: ProjectData,
    color?: SeriesColor,
): OpenProject {
    return {
        id: crypto.randomUUID(),
        slot: freeSlot(projects),
        color: color ?? freeColor(projects),
        data,
        plotted: true,
        unsaved: false,
    };
}

// Nome vazio significa "Projeto sem nome" no idioma ativo (a tradução fica na interface) e pode
// repetir, como nos projetos novos: numerá-lo daria " (2)".
function uniqueName(projects: OpenProject[], name: string): string {
    const taken = new Set(projects.map((p) => p.data.name));

    if (name === '' || !taken.has(name)) {
        return name;
    }

    let copy = 2;

    while (taken.has(`${name} (${copy})`)) {
        copy++;
    }

    return `${name} (${copy})`;
}

export function storageProbe(
    storage: () => Storage = () => window.localStorage,
): boolean {
    try {
        storage().setItem('buildbass.probe', '1');
        storage().removeItem('buildbass.probe');

        return true;
    } catch {
        return false;
    }
}

export function initialWorkspace(): Pick<
    WorkspaceState,
    'projects' | 'activeId'
> {
    const first = openEntry([], createProjectData(''));

    return { projects: [first], activeId: first.id };
}

// Um store com histórico de desfazer por projeto aberto; fica fora do estado persistido.
const stores = new Map<string, ProjectStore>();
// Ligado enquanto o workspace empurra dados para um store (não é edição do usuário).
let syncing = false;

export const useWorkspace = create<WorkspaceState>()(
    persist(
        (set, get) => ({
            ...initialWorkspace(),
            storageAvailable: storageProbe(),
            newProject: () => {
                const { projects } = get();

                if (projects.length >= MAX_OPEN_PROJECTS) {
                    return 'limit';
                }

                const entry = openEntry(projects, createProjectData(''));
                set({ projects: [...projects, entry], activeId: entry.id });

                return 'ok';
            },
            openProject: (data, color) => {
                const { projects } = get();

                if (projects.length >= MAX_OPEN_PROJECTS) {
                    return 'limit';
                }

                const entry = openEntry(
                    projects,
                    { ...data, name: uniqueName(projects, data.name) },
                    color,
                );
                set({ projects: [...projects, entry], activeId: entry.id });

                return 'ok';
            },
            closeProject: (id) => {
                const { projects, activeId } = get();
                const index = projects.findIndex((p) => p.id === id);

                if (index === -1) {
                    return;
                }

                stores.delete(id);
                const rest = projects.filter((p) => p.id !== id);

                if (rest.length === 0) {
                    set(initialWorkspace());

                    return;
                }

                const nextActive =
                    activeId === id
                        ? rest[Math.max(0, index - 1)].id
                        : activeId;
                set({ projects: rest, activeId: nextActive });
            },
            setActive: (id) => {
                if (get().projects.some((p) => p.id === id)) {
                    set({ activeId: id });
                }
            },
            setColor: (id, color) => {
                if (!validColor(color)) {
                    return;
                }

                set(({ projects }) => ({
                    projects: projects.map((p) =>
                        p.id === id ? { ...p, color } : p,
                    ),
                }));
            },
            togglePlotted: (id) =>
                set(({ projects }) => ({
                    projects: projects.map((p) =>
                        p.id === id ? { ...p, plotted: !p.plotted } : p,
                    ),
                })),
            markExported: (id) =>
                set(({ projects }) => ({
                    projects: projects.map((p) =>
                        p.id === id ? { ...p, unsaved: false } : p,
                    ),
                })),
        }),
        {
            name: WORKSPACE_KEY,
            version: 2,
            // v1 → v2: a cor passa a ser própria do projeto; quem só tinha o slot herda a cor dele.
            migrate: (persisted, version) => {
                const state = persisted as {
                    projects?: { slot?: number; color?: unknown }[];
                };

                if (version < 2 && Array.isArray(state.projects)) {
                    state.projects = state.projects.map((p) => ({
                        ...p,
                        color: validColor(p.color)
                            ? p.color
                            : validColor(p.slot)
                              ? p.slot
                              : 1,
                    }));
                }

                return state as never;
            },
            storage: createJSONStorage(() => createSafeStorage()),
            partialize: ({ projects, activeId }) => ({ projects, activeId }),
        },
    ),
);

function writeBack(id: string, data: ProjectData) {
    useWorkspace.setState(({ projects }) => ({
        projects: projects.map((p) =>
            p.id === id ? { ...p, data, unsaved: true } : p,
        ),
    }));
}

// Store do projeto (criado sob demanda a partir dos dados salvos). Toda edição volta para o
// workspace, que é o que se persiste.
export function projectStore(id: string): ProjectStore {
    const existing = stores.get(id);

    if (existing !== undefined) {
        return existing;
    }

    const entry = useWorkspace.getState().projects.find((p) => p.id === id);
    const store = createProjectStore(entry?.data ?? createProjectData(''));
    store.subscribe((state, previous) => {
        if (!syncing && state.data !== previous.data) {
            writeBack(id, state.data);
        }
    });
    stores.set(id, store);

    return store;
}

// Atualiza um projeto sem criar etapa de desfazer (mudanças vindas de fora da edição).
function replaceQuietly(id: string, data: ProjectData) {
    const store = stores.get(id);

    if (store === undefined) {
        return;
    }

    syncing = true;
    store.temporal.getState().pause();
    store.setState({ data });
    store.temporal.getState().resume();
    syncing = false;
}

// Trocar o sistema de unidades devolve todos os campos de todos os projetos à unidade padrão do
// novo sistema; os valores SI não mudam.
usePreferences.subscribe((state, previous) => {
    if (state.unitSystem === previous.unitSystem) {
        return;
    }

    for (const project of useWorkspace.getState().projects) {
        replaceQuietly(project.id, { ...project.data, fieldUnits: {} });
    }

    useWorkspace.setState(({ projects }) => ({
        projects: projects.map((p) => ({
            ...p,
            data: { ...p.data, fieldUnits: {} },
        })),
    }));
});

// Outra janela com o app salvou os projetos: recarrega quando esta janela voltar ao foco.
let externalChange = false;

export async function reloadFromStorage() {
    await useWorkspace.persist.rehydrate();

    const { projects } = useWorkspace.getState();

    for (const id of stores.keys()) {
        const entry = projects.find((p) => p.id === id);

        if (entry === undefined) {
            stores.delete(id);
            continue;
        }

        replaceQuietly(id, entry.data);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === WORKSPACE_KEY) {
            externalChange = true;
        }
    });
    window.addEventListener('focus', () => {
        if (externalChange) {
            externalChange = false;
            void reloadFromStorage();
        }
    });
}
