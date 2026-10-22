import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { LanguageSwitch } from './language-switch';

describe('LanguageSwitch', () => {
    beforeEach(() => {
        localStorage.clear();
        usePreferences.setState({ locale: 'pt-BR' });
    });

    test('o botão mostra a bandeira do Brasil e o código BR', () => {
        const { container } = renderWithProviders(<LanguageSwitch />);
        const button = screen.getByRole('button', { name: 'BR — Idioma' });

        expect(button).toHaveTextContent('BR');
        expect(button.querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true',
        );
        expect(container.innerHTML).toContain('flag-br-green');
        expect(button).not.toHaveTextContent('PT');
    });

    test('o menu traz bandeira e nome por extenso em cada opção', async () => {
        renderWithProviders(<LanguageSwitch />);

        await userEvent.click(
            screen.getByRole('button', { name: 'BR — Idioma' }),
        );
        const menu = await screen.findByRole('menu');
        const brazil = within(menu).getByRole('menuitemradio', {
            name: 'Português (Brasil)',
        });
        const english = within(menu).getByRole('menuitemradio', {
            name: 'English',
        });

        expect(brazil.querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true',
        );
        expect(english.querySelector('svg')).toHaveAttribute(
            'aria-hidden',
            'true',
        );
        expect(brazil.innerHTML).toContain('flag-br-green');
        expect(english.innerHTML).toContain('flag-us-red');
        expect(brazil).toHaveAttribute('aria-checked', 'true');
        expect(english).toHaveAttribute('aria-checked', 'false');
    });

    test('trocar para inglês atualiza o botão (EN, bandeira dos EUA) e marca a opção ativa', async () => {
        renderWithProviders(<LanguageSwitch />);

        await userEvent.click(
            screen.getByRole('button', { name: 'BR — Idioma' }),
        );
        await userEvent.click(
            await screen.findByRole('menuitemradio', { name: 'English' }),
        );

        expect(usePreferences.getState().locale).toBe('en');
        // O idioma da interface acompanha a preferência na raiz do app; aqui só o botão muda.
        const button = await screen.findByRole('button', {
            name: 'EN — Idioma',
        });
        expect(button).toHaveTextContent('EN');
        expect(button.innerHTML).toContain('flag-us-red');

        await userEvent.click(button);
        expect(
            await screen.findByRole('menuitemradio', { name: 'English' }),
        ).toHaveAttribute('aria-checked', 'true');
    });
});
