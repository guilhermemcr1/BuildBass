import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { detectLocale } from '@/i18n';
import type { Locale } from '@/i18n';
import type { UnitSystem } from '@/lib/units/quantities';

export type ThemeChoice = 'light' | 'dark' | 'system';

// Normal esconde os campos não essenciais atrás de "Mostrar mais"; Pro abre tudo.
export type Mode = 'normal' | 'pro';

export function validMode(value: unknown): value is Mode {
    return value === 'normal' || value === 'pro';
}

export const PREFERENCES_KEY = 'buildbass.preferences';

type PreferencesState = {
    theme: ThemeChoice;
    locale: Locale;
    unitSystem: UnitSystem;
    mode: Mode;
    // Lateral da bancada (≥ 1280 px) recolhida num trilho estreito, deixando espaço ao conteúdo.
    sidebarCollapsed: boolean;
    // O assistente já abriu sozinho uma vez (primeira visita); depois só pelo botão da barra.
    assistantSeen: boolean;
    setTheme: (theme: ThemeChoice) => void;
    setLocale: (locale: Locale) => void;
    setUnitSystem: (unitSystem: UnitSystem) => void;
    setMode: (mode: Mode) => void;
    setSidebarCollapsed: (sidebarCollapsed: boolean) => void;
    setAssistantSeen: () => void;
};

// Janela privada ou cookies bloqueados fazem o localStorage lançar erro; nesse caso as escolhas
// valem só na sessão, em memória, sem mostrar erro ao usuário.
export function createSafeStorage(
    resolveStorage: () => Storage = () => window.localStorage,
): StateStorage {
    const memory = new Map<string, string>();

    return {
        getItem(name) {
            try {
                return resolveStorage().getItem(name);
            } catch {
                return memory.get(name) ?? null;
            }
        },
        setItem(name, value) {
            try {
                resolveStorage().setItem(name, value);
            } catch {
                memory.set(name, value);
            }
        },
        removeItem(name) {
            try {
                resolveStorage().removeItem(name);
            } catch {
                memory.delete(name);
            }
        },
    };
}

export const usePreferences = create<PreferencesState>()(
    persist(
        (set) => ({
            theme: 'system',
            locale: detectLocale(
                typeof navigator === 'undefined'
                    ? undefined
                    : navigator.language,
            ),
            unitSystem: 'metric',
            mode: 'normal',
            sidebarCollapsed: false,
            assistantSeen: false,
            setTheme: (theme) => set({ theme }),
            setLocale: (locale) => set({ locale }),
            setUnitSystem: (unitSystem) => set({ unitSystem }),
            setMode: (mode) => set({ mode }),
            setSidebarCollapsed: (sidebarCollapsed) =>
                set({ sidebarCollapsed }),
            setAssistantSeen: () => set({ assistantSeen: true }),
        }),
        {
            name: PREFERENCES_KEY,
            version: 3,
            storage: createJSONStorage(() => createSafeStorage()),
            partialize: ({
                theme,
                locale,
                unitSystem,
                mode,
                sidebarCollapsed,
                assistantSeen,
            }) => ({
                theme,
                locale,
                unitSystem,
                mode,
                sidebarCollapsed,
                assistantSeen,
            }),
            // v1 não tinha modo: quem já tinha preferências entra no Normal. Até a v2 não havia
            // assistente: quem já usava a bancada não o vê abrir sozinho.
            migrate: (persisted, version) => ({
                ...(persisted as object),
                ...(version < 2 ? { mode: 'normal' } : {}),
                ...(version < 3 ? { assistantSeen: true } : {}),
            }),
            // Valor de modo inválido (arquivo adulterado) volta ao padrão em vez de quebrar a tela.
            merge: (persisted, current) => {
                const saved = (persisted ?? {}) as Partial<PreferencesState>;

                return {
                    ...current,
                    ...saved,
                    mode: validMode(saved.mode) ? saved.mode : current.mode,
                    sidebarCollapsed:
                        typeof saved.sidebarCollapsed === 'boolean'
                            ? saved.sidebarCollapsed
                            : current.sidebarCollapsed,
                    assistantSeen:
                        typeof saved.assistantSeen === 'boolean'
                            ? saved.assistantSeen
                            : current.assistantSeen,
                };
            },
        },
    ),
);
