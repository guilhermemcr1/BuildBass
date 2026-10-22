import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sanitizeSavedDriver } from '@/lib/saved-drivers/sanitize';
import { SAVED_DRIVERS_MAX, identityOf } from '@/lib/saved-drivers/types';
import type { SavedDriver, SavedDriverDraft } from '@/lib/saved-drivers/types';
import { createSafeStorage } from './preferences';

export const SAVED_DRIVERS_KEY = 'buildbass.savedDrivers';

export type SaveResult =
    | { status: 'saved'; driver: SavedDriver }
    | { status: 'duplicate'; existing: SavedDriver }
    | { status: 'full' };

export type ImportResult =
    | { status: 'ok'; added: number; replaced: number; ignored: number }
    | { status: 'tooMany'; total: number };

type SavedDriversState = {
    // Mais novo primeiro.
    items: SavedDriver[];
    save: (draft: SavedDriverDraft) => SaveResult;
    // Atualiza um item existente (editar ou "substituir" depois do aviso de duplicata).
    replace: (id: string, draft: SavedDriverDraft) => void;
    remove: (id: string) => void;
    // Importação em lote: duplicatas são substituídas ou mantidas, todas do mesmo jeito.
    importMany: (
        drafts: SavedDriverDraft[],
        onDuplicate: 'replace' | 'keep',
    ) => ImportResult;
};

function stamp(draft: SavedDriverDraft, id: string): SavedDriver {
    return { ...draft, id, savedAt: new Date().toISOString() };
}

function byNewest(a: SavedDriver, b: SavedDriver): number {
    return Date.parse(b.savedAt) - Date.parse(a.savedAt);
}

export const useSavedDrivers = create<SavedDriversState>()(
    persist(
        (set, get) => ({
            items: [],
            save: (draft) => {
                const { items } = get();
                const existing = items.find(
                    (item) => identityOf(item) === identityOf(draft),
                );

                if (existing !== undefined) {
                    return { status: 'duplicate', existing };
                }

                if (items.length >= SAVED_DRIVERS_MAX) {
                    return { status: 'full' };
                }

                const driver = stamp(draft, crypto.randomUUID());
                set({ items: [driver, ...items] });

                return { status: 'saved', driver };
            },
            replace: (id, draft) =>
                set(({ items }) => ({
                    items: items
                        .map((item) =>
                            item.id === id ? stamp(draft, id) : item,
                        )
                        .sort(byNewest),
                })),
            remove: (id) =>
                set(({ items }) => ({
                    items: items.filter((item) => item.id !== id),
                })),
            importMany: (drafts, onDuplicate) => {
                const { items } = get();
                const known = new Map(
                    items.map((item) => [identityOf(item), item]),
                );
                const fresh = drafts.filter(
                    (draft) => !known.has(identityOf(draft)),
                );

                if (items.length + fresh.length > SAVED_DRIVERS_MAX) {
                    return {
                        status: 'tooMany',
                        total: items.length + fresh.length,
                    };
                }

                const duplicates = drafts.filter((draft) =>
                    known.has(identityOf(draft)),
                );
                const replaced = onDuplicate === 'replace' ? duplicates : [];
                const replacedKeys = new Set(replaced.map(identityOf));
                const kept = items.map((item) => {
                    const match = replaced.find(
                        (draft) => identityOf(draft) === identityOf(item),
                    );

                    return match === undefined ? item : stamp(match, item.id);
                });
                const added = fresh.map((draft) =>
                    stamp(draft, crypto.randomUUID()),
                );

                set({ items: [...added, ...kept].sort(byNewest) });

                return {
                    status: 'ok',
                    added: added.length,
                    replaced: replacedKeys.size,
                    ignored: duplicates.length - replaced.length,
                };
            },
        }),
        {
            name: SAVED_DRIVERS_KEY,
            version: 1,
            storage: createJSONStorage(() => createSafeStorage()),
            partialize: ({ items }) => ({ items }),
            // O navegador é terreno do usuário: o que não tem a forma esperada é descartado.
            merge: (persisted, current) => {
                const raw = (persisted as { items?: unknown } | null)?.items;
                const items = Array.isArray(raw)
                    ? (raw as unknown[])
                          .map(sanitizeSavedDriver)
                          .filter(
                              (item): item is SavedDriver => item !== undefined,
                          )
                          .slice(0, SAVED_DRIVERS_MAX)
                    : [];

                return { ...current, items };
            },
        },
    ),
);
