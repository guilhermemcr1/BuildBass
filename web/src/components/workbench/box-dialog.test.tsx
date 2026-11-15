import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { BoxPanel } from './box-panel';

function fillProject() {
    act(() => {
        const { setDriverValue, setBoxValue } = activeProjectStore().getState();
        setDriverValue('fs_hz', 28);
        setDriverValue('qts', 0.38);
        setDriverValue('qes', 0.42);
        setDriverValue('qms', 4.1);
        setDriverValue('vas_m3', 0.085);
        setDriverValue('re_ohm', 3.6);
        setDriverValue('sd_m2', 0.0491);
        setBoxValue('vb_m3', 0.06);
    });
}

async function openDialog() {
    const opener = screen.getByRole('button', { name: 'Ampliar caixa' });
    await userEvent.click(opener);

    return {
        opener,
        dialog: await screen.findByRole('dialog', { name: 'Caixa' }),
    };
}

describe('BoxDialog', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('abre com os campos do tipo de caixa e o 3D com as cotas', async () => {
        fillProject();
        act(() =>
            activeProjectStore()
                .getState()
                .apply((data) => ({
                    ...data,
                    cutPlan: { ...data.cutPlan, cutout_m: 0.2 },
                })),
        );
        renderWithProviders(<BoxPanel />);

        const { dialog } = await openDialog();

        expect(
            within(dialog).getByRole('radio', { name: 'Selada' }),
        ).toBeInTheDocument();
        expect(
            within(dialog).getByRole('textbox', { name: /^Vb/ }),
        ).toBeVisible();
        const image = await within(dialog).findByRole('img');

        expect(image).toBeVisible();
        expect(image).toHaveAccessibleName(/Alto-falante na frente\./);
        expect(image.querySelector('[data-layer="cone"]')).not.toBeNull();
    });

    test('mudar um campo no modal atualiza o projeto ativo e a medida do 3D', async () => {
        fillProject();
        renderWithProviders(<BoxPanel />);
        const { dialog } = await openDialog();
        const image = await within(dialog).findByRole('img');
        const before = image.getAttribute('aria-label');

        const vb = within(dialog).getByRole('textbox', { name: /^Vb/ });
        await userEvent.clear(vb);
        await userEvent.type(vb, '90{Enter}');

        expect(activeProjectStore().getState().data.box.vb_m3).toBeCloseTo(
            0.09,
            6,
        );
        await waitFor(() =>
            expect(
                within(dialog).getByRole('img').getAttribute('aria-label'),
            ).not.toBe(before),
        );
    });

    test('plano bloqueado lista o que falta', async () => {
        renderWithProviders(<BoxPanel />);

        const { dialog } = await openDialog();

        expect(
            within(dialog).getByText(/Para ver a caixa em 3D falta informar:/),
        ).toBeVisible();
        expect(within(dialog).queryByRole('img')).toBeNull();
    });

    test('sem o recorte do alto-falante avisa que ele não foi informado', async () => {
        fillProject();
        renderWithProviders(<BoxPanel />);

        const { dialog } = await openDialog();

        expect(
            await within(dialog).findByText(/O diâmetro do recorte do driver/),
        ).toBeVisible();
        expect(dialog.querySelector('[data-part="driver"]')).toBeNull();
    });

    test('Esc fecha, o foco volta ao gatilho e o fundo fica inerte enquanto aberto', async () => {
        fillProject();
        renderWithProviders(<BoxPanel />);
        const { opener, dialog } = await openDialog();

        // Fundo inerte: o painel atrás do modal fica oculto para a árvore de acessibilidade.
        expect(
            screen.queryByRole('button', { name: 'Ver caixa em 3D' }),
        ).toBeNull();

        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(dialog).not.toBeInTheDocument());
        await waitFor(() => expect(opener).toHaveFocus());
    });
});
