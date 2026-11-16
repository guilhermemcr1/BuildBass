import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { renderWithProviders } from '@/test/render';
import { STEPS } from './steps';
import Tutorial from './tutorial';

describe('Tutorial', () => {
    beforeEach(() => {
        // jsdom não rola nem mede; o que importa aqui é o fluxo.
        Element.prototype.scrollIntoView = vi.fn();
    });

    test('abre no primeiro passo, sem alvo, com o botão Próximo em foco', async () => {
        renderWithProviders(<Tutorial onClose={() => undefined} />);

        const dialog = await screen.findByRole('dialog', {
            name: 'Bem-vindo ao BuildBass',
        });

        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(screen.getByText(`Passo 1 de ${STEPS.length}`)).toBeVisible();
        expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled();
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: 'Próximo' }),
            ).toHaveFocus(),
        );
    });

    test('Próximo e Voltar andam pelos passos e as setas fazem o mesmo', async () => {
        renderWithProviders(<Tutorial onClose={() => undefined} />);

        await userEvent.click(
            await screen.findByRole('button', { name: 'Próximo' }),
        );
        expect(
            screen.getByRole('dialog', { name: 'Seus projetos' }),
        ).toBeVisible();
        expect(screen.getByText(`Passo 2 de ${STEPS.length}`)).toBeVisible();

        await userEvent.keyboard('{ArrowRight}');
        expect(
            screen.getByRole('dialog', { name: '1. Escolha o alto-falante' }),
        ).toBeVisible();

        await userEvent.keyboard('{ArrowLeft}');
        await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
        expect(
            screen.getByRole('dialog', { name: 'Bem-vindo ao BuildBass' }),
        ).toBeVisible();
    });

    test('os pontos levam direto ao passo e marcam o atual', async () => {
        renderWithProviders(<Tutorial onClose={() => undefined} />);

        await userEvent.click(
            await screen.findByRole('button', { name: 'Ir ao passo 5' }),
        );

        expect(
            screen.getByRole('dialog', { name: '2. Monte a caixa' }),
        ).toBeVisible();
        expect(
            screen.getByRole('button', { name: 'Ir ao passo 5' }),
        ).toHaveAttribute('aria-current', 'step');
    });

    test('no último passo o botão vira Concluir e fecha', async () => {
        const onClose = vi.fn();

        renderWithProviders(<Tutorial onClose={onClose} />);
        await userEvent.click(
            await screen.findByRole('button', {
                name: `Ir ao passo ${STEPS.length}`,
            }),
        );

        expect(screen.queryByRole('button', { name: 'Próximo' })).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('Esc e o X fecham', async () => {
        const onClose = vi.fn();

        renderWithProviders(<Tutorial onClose={onClose} />);
        await screen.findByRole('dialog');

        await userEvent.keyboard('{Escape}');
        await userEvent.click(
            screen.getByRole('button', { name: 'Fechar tutorial' }),
        );

        expect(onClose).toHaveBeenCalledTimes(2);
    });

    test('Tab não sai do cartão', async () => {
        renderWithProviders(<Tutorial onClose={() => undefined} />);
        const dialog = await screen.findByRole('dialog');

        for (let press = 0; press < 20; press++) {
            await userEvent.tab();
            expect(dialog).toContainElement(
                document.activeElement as HTMLElement,
            );
        }
    });

    test('devolve o foco a quem abriu', async () => {
        const opener = document.createElement('button');

        document.body.append(opener);
        opener.focus();

        const { unmount } = renderWithProviders(
            <Tutorial onClose={() => undefined} />,
        );

        await screen.findByRole('dialog');
        unmount();

        expect(opener).toHaveFocus();
        opener.remove();
    });

    test('todo passo tem título e texto nos dois idiomas', async () => {
        const { resources } = await import('@/i18n');

        for (const locale of ['pt-BR', 'en'] as const) {
            for (const step of STEPS) {
                const entry = (
                    resources[locale].tutorial.steps as Record<
                        string,
                        { title: string; body: string }
                    >
                )[step.id];

                expect(entry?.title, `${locale}/${step.id}`).toBeTruthy();
                expect(entry?.body, `${locale}/${step.id}`).toBeTruthy();
            }
        }
    });
});
