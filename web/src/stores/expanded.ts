import { create } from 'zustand';
import { SECTION_IDS } from '@/lib/parameters';
import type { SectionId } from '@/lib/parameters';
import { usePreferences } from './preferences';

type ExpandedState = {
    open: Record<SectionId, boolean>;
    toggle: (id: SectionId) => void;
    expand: (id: SectionId) => void;
    expandAll: () => void;
    collapseAll: () => void;
};

function all(open: boolean): Record<SectionId, boolean> {
    return Object.fromEntries(SECTION_IDS.map((id) => [id, open])) as Record<
        SectionId,
        boolean
    >;
}

// Quais seções "Mostrar mais" estão abertas. Só em memória: ao carregar a página segue o modo
// salvo (Pro → tudo aberto, Normal → tudo recolhido) e não vira preferência (specs/008, R13).
export const useExpanded = create<ExpandedState>()((set) => ({
    open: all(usePreferences.getState().mode === 'pro'),
    toggle: (id) => set(({ open }) => ({ open: { ...open, [id]: !open[id] } })),
    expand: (id) => set(({ open }) => ({ open: { ...open, [id]: true } })),
    expandAll: () => set({ open: all(true) }),
    collapseAll: () => set({ open: all(false) }),
}));

// Trocar o modo abre (Pro) ou recolhe (Normal) todas as seções de uma vez; depois o usuário pode
// abrir ou fechar uma sozinha sem mudar o modo (FR-030).
usePreferences.subscribe((state, previous) => {
    if (state.mode === previous.mode) {
        return;
    }

    if (state.mode === 'pro') {
        useExpanded.getState().expandAll();
    } else {
        useExpanded.getState().collapseAll();
    }
});
