import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { detectLocale } from '@/i18n';
import type { Locale } from '@/i18n';
import type { UnitSystem } from '@/lib/units/quantities';

export type ThemeChoice = 'light' | 'dark' | 'system';

export const PREFERENCES_KEY = 'buildbass.preferences';

type PreferencesState = {
    theme: ThemeChoice;
    locale: Locale;
    unitSystem: UnitSystem;
    setTheme: (theme: ThemeChoice) => void;
    setLocale: (locale: Locale) => void;
    setUnitSystem: (unitSystem: UnitSystem) => void;
};

// Janela privada ou cookies bloqueados fazem o localStorage lançar erro; nesse caso as escolhas
// valem só na sessão, em memória, sem mostrar erro ao usuário (FR-018).
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
            setTheme: (theme) => set({ theme }),
            setLocale: (locale) => set({ locale }),
            setUnitSystem: (unitSystem) => set({ unitSystem }),
        }),
        {
            name: PREFERENCES_KEY,
            version: 1,
            storage: createJSONStorage(() => createSafeStorage()),
            partialize: ({ theme, locale, unitSystem }) => ({
                theme,
                locale,
                unitSystem,
            }),
        },
    ),
);
