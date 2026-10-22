import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { useExpanded } from '@/stores/expanded';
import { renderWithProviders } from '@/test/render';
import { ShowMore } from './show-more';

function renderIt(filled?: number) {
    return renderWithProviders(
        <ShowMore id="driverAdvanced" filled={filled}>
            <input aria-label="Campo avançado" />
        </ShowMore>,
    );
}

describe('ShowMore', () => {
    beforeEach(() => {
        useExpanded.getState().collapseAll();
    });

    test('começa recolhido: aria-expanded falso e conteúdo fora da árvore de acessibilidade', () => {
        renderIt();

        expect(
            screen.getByRole('button', { name: 'Mostrar mais' }),
        ).toHaveAttribute('aria-expanded', 'false');
        expect(
            screen.queryByRole('textbox', { name: 'Campo avançado' }),
        ).not.toBeInTheDocument();
    });

    test('Enter e Espaço abrem e fecham; o texto vira "Mostrar menos"', async () => {
        renderIt();
        const trigger = screen.getByRole('button', { name: 'Mostrar mais' });

        trigger.focus();
        await userEvent.keyboard('{Enter}');

        expect(
            screen.getByRole('button', { name: 'Mostrar menos' }),
        ).toHaveAttribute('aria-expanded', 'true');
        expect(
            screen.getByRole('textbox', { name: 'Campo avançado' }),
        ).toBeVisible();

        await userEvent.keyboard(' ');

        expect(
            screen.getByRole('button', { name: 'Mostrar mais' }),
        ).toHaveAttribute('aria-expanded', 'false');
        expect(useExpanded.getState().open.driverAdvanced).toBe(false);
    });

    test('segue o estado do store (modo Pro abre sozinho)', () => {
        renderIt();

        act(() => useExpanded.getState().expandAll());

        expect(
            screen.getByRole('button', { name: 'Mostrar menos' }),
        ).toHaveAttribute('aria-expanded', 'true');
    });

    test('recolhido com campos preenchidos, o botão diz quantos em texto', () => {
        renderIt(2);

        expect(
            screen.getByRole('button', { name: 'Mostrar mais (2 preenchidos)' }),
        ).toBeVisible();
    });

    test('aberto, o aviso de preenchidos some', () => {
        renderIt(1);

        act(() => useExpanded.getState().expandAll());

        expect(
            screen.getByRole('button', { name: 'Mostrar menos' }),
        ).toBeVisible();
    });

    test('em inglês', () => {
        renderWithProviders(
            <ShowMore id="planAdvanced" filled={1}>
                <span>x</span>
            </ShowMore>,
            'en',
        );

        expect(
            screen.getByRole('button', { name: 'Show more (1 filled)' }),
        ).toBeVisible();
    });
});
