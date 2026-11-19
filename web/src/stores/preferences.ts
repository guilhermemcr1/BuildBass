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
    setTheme: (theme: ThemeChoice) => void;
    setLocale: (locale: Locale) => void;
    setUnitSystem: (unitSystem: UnitSystem) => void;
    setMode: (mode: Mode) => void;
    setSidebarCollapsed: (sidebarCollapsed: boolean) => void;
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
            setTheme: (theme) => set({ theme }),
            setLocale: (locale) => set({ locale }),
            setUnitSystem: (unitSystem) => set({ unitSystem }),
            setMode: (mode) => set({ mode }),
            setSidebarCollapsed: (sidebarCollapsed) =>
                set({ sidebarCollapsed }),
        }),
        {
            name: PREFERENCES_KEY,
            version: 2,
            storage: createJSONStorage(() => createSafeStorage()),
            partialize: ({
                theme,
                locale,
                unitSystem,
                mode,
                sidebarCollapsed,
            }) => ({
                theme,
                locale,
                unitSystem,
                mode,
                sidebarCollapsed,
            }),
            // v1 não tinha modo: quem já tinha preferências entra no Normal.
            migrate: (persisted, version) =>
                version < 2
                    ? { ...(persisted as object), mode: 'normal' }
                    : persisted,
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
                };
            },
        },
    ),
);
