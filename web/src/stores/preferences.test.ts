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
        });
    });

    test('grava tema, idioma e sistema de unidades no localStorage', () => {
        usePreferences.getState().setTheme('dark');
        usePreferences.getState().setLocale('en');
        usePreferences.getState().setUnitSystem('imperial');

        const saved = JSON.parse(
            window.localStorage.getItem(PREFERENCES_KEY) ?? '{}',
        );

        expect(saved.state).toEqual({
            theme: 'dark',
            locale: 'en',
            unitSystem: 'imperial',
        });
        expect(saved.version).toBe(1);
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
