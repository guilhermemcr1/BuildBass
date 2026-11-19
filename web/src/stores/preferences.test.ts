import { beforeEach, describe, expect, test } from 'vite-plus/test';
import {
    PREFERENCES_KEY,
    createSafeStorage,
    usePreferences,
} from './preferences';

describe('preferências', () => {
    beforeEach(() => {
        window.localStorage.clear();
        usePreferences.setState({
            theme: 'system',
            locale: 'pt-BR',
            unitSystem: 'metric',
            mode: 'normal',
            assistantSeen: false,
        });
    });

    test('grava tema, idioma, unidades e modo no localStorage', () => {
        usePreferences.getState().setTheme('dark');
        usePreferences.getState().setLocale('en');
        usePreferences.getState().setUnitSystem('imperial');
        usePreferences.getState().setMode('pro');

        const saved = JSON.parse(
            window.localStorage.getItem(PREFERENCES_KEY) ?? '{}',
        );

        expect(saved.state).toEqual({
            theme: 'dark',
            locale: 'en',
            unitSystem: 'imperial',
            mode: 'pro',
            sidebarCollapsed: false,
            assistantSeen: false,
        });
        expect(saved.version).toBe(3);
    });

    test('a lateral começa aberta e lembra quando foi recolhida', () => {
        expect(usePreferences.getState().sidebarCollapsed).toBe(false);
        usePreferences.getState().setSidebarCollapsed(true);
        expect(usePreferences.getState().sidebarCollapsed).toBe(true);
        usePreferences.getState().setSidebarCollapsed(false);
    });

    test('o modo padrão é Normal', () => {
        expect(usePreferences.getState().mode).toBe('normal');
    });

    test('preferências da versão 1 (sem modo) migram para Normal', async () => {
        window.localStorage.setItem(
            PREFERENCES_KEY,
            JSON.stringify({
                state: { theme: 'dark', locale: 'en', unitSystem: 'imperial' },
                version: 1,
            }),
        );

        await usePreferences.persist.rehydrate();

        expect(usePreferences.getState()).toMatchObject({
            theme: 'dark',
            locale: 'en',
            unitSystem: 'imperial',
            mode: 'normal',
            // Quem já usava a bancada não vê o assistente abrir sozinho.
            assistantSeen: true,
        });
    });

    test('o assistente abre sozinho só até ser fechado uma vez', () => {
        expect(usePreferences.getState().assistantSeen).toBe(false);
        usePreferences.getState().setAssistantSeen();
        expect(usePreferences.getState().assistantSeen).toBe(true);
    });

    test('modo inválido no armazenamento volta ao padrão', async () => {
        window.localStorage.setItem(
            PREFERENCES_KEY,
            JSON.stringify({
                state: {
                    theme: 'dark',
                    locale: 'en',
                    unitSystem: 'metric',
                    mode: 'expert',
                },
                version: 2,
            }),
        );

        await usePreferences.persist.rehydrate();

        expect(usePreferences.getState().mode).toBe('normal');
    });

    test('cai para memória sem lançar erro quando o localStorage está bloqueado', () => {
        const blocked = createSafeStorage(() => {
            throw new DOMException('bloqueado', 'SecurityError');
        });

        expect(() => blocked.setItem('chave', 'valor')).not.toThrow();
        expect(blocked.getItem('chave')).toBe('valor');

        blocked.removeItem('chave');

        expect(blocked.getItem('chave')).toBeNull();
    });
});
