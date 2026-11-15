import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { DriverPanel } from './driver-panel';

async function openDialog() {
    const opener = screen.getByRole('button', { name: 'Ampliar driver' });

    await userEvent.click(opener);

    return {
        opener,
        dialog: await screen.findByRole('dialog', { name: 'Driver' }),
    };
}

describe('DriverDialog', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('abre com todos os parâmetros, as dimensões, a ligação e o sinal sem nada recolhido', async () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        const { dialog } = await openDialog();

        // Parâmetros que no painel ficam atrás de "Mostrar mais".
        for (const symbol of [
            'Fs',
            'Qts',
            'Qes',
            'Qms',
            'Re',
            'Le',
            'BL',
            'Mms',
        ]) {
            expect(
                within(dialog).getByRole('textbox', {
                    name: new RegExp(`^${symbol}\\s?—`),
                }),
            ).toBeVisible();
        }
        expect(
            within(dialog).getByRole('radio', { name: 'Paralelo' }),
        ).toBeVisible();
        expect(
            within(dialog).getByRole('textbox', { name: /^P\s?—/ }),
        ).toBeVisible();
        expect(
            within(dialog).getByRole('group', {
                name: 'Dimensões do alto-falante',
            }),
        ).toBeVisible();
        expect(
            within(dialog).queryByRole('button', { name: /Mostrar mais/ }),
        ).toBeNull();
        // Muitas consultas por papel num DOM grande: com a suíte toda em paralelo passam de 5 s.
    }, 20_000);

    test('mudar um campo no modal atualiza o projeto ativo', async () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        const { dialog } = await openDialog();

        await userEvent.type(
            within(dialog).getByRole('textbox', { name: /^Fs\s?—/ }),
            '30{Tab}',
        );

        expect(activeProjectStore().getState().data.driver.fs_hz).toBe(30);
    });

    test('Esc fecha o modal e devolve o foco ao botão', async () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        const { opener, dialog } = await openDialog();

        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(dialog).not.toBeInTheDocument());
        await waitFor(() => expect(opener).toHaveFocus());
    });
});
