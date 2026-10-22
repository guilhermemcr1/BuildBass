import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import type { SavedDriverDraft } from '@/lib/saved-drivers/types';
import { usePreferences } from '@/stores/preferences';
import { useSavedDrivers } from '@/stores/saved-drivers';
import { renderWithProviders } from '@/test/render';
import SaveDriverDialog from './save-driver-dialog';

const INITIAL: SavedDriverDraft = {
    brand: 'Marca',
    model: 'Sub 12',
    driver: { fs_hz: 32, qts: 0.42, vas_m3: 0.09 },
};

function open(initial: SavedDriverDraft = INITIAL) {
    const onClose = vi.fn();
    renderWithProviders(
        <SaveDriverDialog initial={initial} onClose={onClose} />,
    );

    return onClose;
}

describe('SaveDriverDialog', () => {
    beforeEach(() => {
        localStorage.clear();
        useSavedDrivers.setState({ items: [] });
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('abre com marca e modelo da origem e avisa quantos parâmetros vão junto', () => {
        open();

        const dialog = screen.getByRole('dialog', {
            name: 'Salvar alto-falante',
        });

        expect(
            within(dialog).getByRole('textbox', { name: /Marca/ }),
        ).toHaveValue('Marca');
        expect(
            within(dialog).getByRole('textbox', { name: /Modelo/ }),
        ).toHaveValue('Sub 12');
        expect(
            within(dialog).getByText(/3 parâmetros T\/S do projeto/),
        ).toBeVisible();
    });

    test('salvar guarda o item com as medidas físicas e fecha', async () => {
        const onClose = open();

        await userEvent.type(
            screen.getByRole('textbox', { name: /Variação/ }),
            '4 Ω',
        );
        await userEvent.type(
            screen.getByRole('textbox', { name: /Profundidade/ }),
            '150',
        );
        await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

        const [item] = useSavedDrivers.getState().items;
        expect(item).toMatchObject({
            brand: 'Marca',
            model: 'Sub 12',
            variant: '4 Ω',
            driver: INITIAL.driver,
        });
        expect(item.depth_m).toBeCloseTo(0.15, 6);
        expect(onClose).toHaveBeenCalled();
    });

    test('sem marca ou modelo o botão Salvar fica desativado', async () => {
        open({ ...INITIAL, brand: '' });

        expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();

        await userEvent.type(
            screen.getByRole('textbox', { name: /Marca/ }),
            'X',
        );

        expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();
    });

    test('nome repetido pergunta Substituir ou Cancelar', async () => {
        useSavedDrivers.getState().save({ ...INITIAL, brand: 'marca' });
        const onClose = open();

        await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

        const ask = await screen.findByRole('dialog', {
            name: 'Já existe um alto-falante com esse nome',
        });
        expect(onClose).not.toHaveBeenCalled();

        await userEvent.click(
            within(ask).getByRole('button', { name: 'Substituir' }),
        );

        const { items } = useSavedDrivers.getState();
        expect(items).toHaveLength(1);
        expect(items[0].brand).toBe('Marca');
        expect(onClose).toHaveBeenCalled();
    });

    test('Cancelar na pergunta de duplicata volta ao formulário sem salvar', async () => {
        useSavedDrivers.getState().save(INITIAL);
        open();

        await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
        const ask = await screen.findByRole('dialog', {
            name: 'Já existe um alto-falante com esse nome',
        });
        await userEvent.click(
            within(ask).getByRole('button', { name: 'Cancelar' }),
        );

        expect(
            await screen.findByRole('dialog', { name: 'Salvar alto-falante' }),
        ).toBeVisible();
        expect(useSavedDrivers.getState().items).toHaveLength(1);
    });

    test('editar muda o item sem criar outro; nome de outro item é recusado', async () => {
        useSavedDrivers.getState().save(INITIAL);
        useSavedDrivers.getState().save({ ...INITIAL, model: 'Outro' });
        const [other, target] = useSavedDrivers.getState().items;
        const onClose = vi.fn();
        renderWithProviders(
            <SaveDriverDialog
                initial={target}
                editing={target}
                onClose={onClose}
            />,
        );

        expect(
            screen.getByRole('dialog', { name: 'Editar alto-falante' }),
        ).toBeVisible();
        const model = screen.getByRole('textbox', { name: /Modelo/ });
        await userEvent.clear(model);
        await userEvent.type(model, 'Outro');
        await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

        expect(
            await screen.findByText(/Já existe outro alto-falante/),
        ).toBeVisible();
        expect(onClose).not.toHaveBeenCalled();

        await userEvent.clear(model);
        await userEvent.type(model, 'Sub 12 B');
        await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

        const { items } = useSavedDrivers.getState();
        expect(items).toHaveLength(2);
        expect(items.find((item) => item.id === target.id)?.model).toBe(
            'Sub 12 B',
        );
        expect(items.find((item) => item.id === other.id)?.model).toBe('Outro');
        expect(onClose).toHaveBeenCalled();
    });
});
