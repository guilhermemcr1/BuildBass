import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { ThemeSwitch } from './theme-switch';

describe('ThemeSwitch', () => {
    beforeEach(() => {
        usePreferences.setState({ theme: 'system' });
    });

    test('mostra só o tema atual; as três opções aparecem ao abrir', async () => {
        renderWithProviders(<ThemeSwitch />);

        expect(
            screen.getByRole('button', { name: 'Tema: Sistema' }),
        ).toBeVisible();
        expect(screen.queryByRole('menuitemradio')).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: 'Tema: Sistema' }),
        );

        expect(
            screen
                .getAllByRole('menuitemradio')
                .map((item) => item.textContent),
        ).toEqual(['Claro', 'Escuro', 'Sistema']);
    });

    test('escolher uma opção troca o tema e fecha a lista', async () => {
        renderWithProviders(<ThemeSwitch />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Tema: Sistema' }),
        );
        await userEvent.click(
            screen.getByRole('menuitemradio', { name: 'Escuro' }),
        );

        expect(usePreferences.getState().theme).toBe('dark');
        expect(screen.queryByRole('menuitemradio')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Tema: Escuro' }),
        ).toBeVisible();
    });
});
