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

    test('mostra as três opções à vista, com a atual marcada', () => {
        renderWithProviders(<ThemeSwitch />);

        const group = screen.getByRole('radiogroup', { name: 'Tema' });

        expect(group).toBeVisible();
        expect(
            screen.getAllByRole('radio').map((item) => item.textContent),
        ).toEqual(['Claro', 'Escuro', 'Sistema']);
        expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked();
    });

    test('escolher uma opção troca o tema', async () => {
        renderWithProviders(<ThemeSwitch />);

        await userEvent.click(screen.getByRole('radio', { name: 'Escuro' }));

        expect(usePreferences.getState().theme).toBe('dark');
        expect(screen.getByRole('radio', { name: 'Escuro' })).toBeChecked();
    });
});
