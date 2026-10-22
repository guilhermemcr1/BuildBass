import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { downloadSavedDrivers } from '@/lib/saved-drivers/file';
import { exportSavedDrivers } from '@/lib/saved-drivers/file';
import type { SavedDriverDraft } from '@/lib/saved-drivers/types';
import { usePreferences } from '@/stores/preferences';
import { useSavedDrivers } from '@/stores/saved-drivers';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import SavedDriversDialog from './saved-drivers-dialog';

vi.mock('@/lib/saved-drivers/file', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/saved-drivers/file')>()),
    downloadSavedDrivers: vi.fn(),
}));

function draft(model: string, extra: Partial<SavedDriverDraft> = {}) {
    return {
        brand: 'Marca',
        model,
        driver: { fs_hz: 32, qts: 0.42, vas_m3: 0.09 },
        ...extra,
    };
}

function open() {
    const onClose = vi.fn();
    renderWithProviders(<SavedDriversDialog onClose={onClose} />);

    return onClose;
}

function upload(content: string) {
    const input =
        document.querySelector<HTMLInputElement>('input[type="file"]');

    if (input === null) {
        throw new Error('sem campo de arquivo');
    }

    return userEvent.upload(
        input,
        new File([content], 'lista.buildbass-drivers.json', {
            type: 'application/json',
        }),
    );
}

describe('SavedDriversDialog', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        useSavedDrivers.setState({ items: [] });
        usePreferences.setState({ unitSystem: 'metric' });
        vi.mocked(downloadSavedDrivers).mockReset();
    });

    test('lista vazia mostra a orientação e desativa Exportar', () => {
        open();

        expect(
            screen.getByText(/A lista fica só neste navegador/),
        ).toBeVisible();
        expect(
            screen.getByText('Você ainda não salvou nenhum alto-falante.'),
        ).toBeVisible();
        expect(screen.getByRole('button', { name: /Exportar/ })).toBeDisabled();
    });

    test('lista os salvos com as medidas físicas e filtra pela busca', async () => {
        useSavedDrivers
            .getState()
            .save(draft('Sub 12', { nominal_diameter_m: 0.31, depth_m: 0.15 }));
        useSavedDrivers.getState().save(draft('Mid 8'));
        open();

        const list = screen.getByRole('list', { name: 'Meus alto-falantes' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(2);
        expect(within(list).getByText(/Ø .*·.*prof\./)).toBeVisible();

        await userEvent.type(
            screen.getByRole('searchbox', {
                name: 'Buscar nos meus alto-falantes',
            }),
            'mid',
        );

        expect(within(list).getAllByRole('listitem')).toHaveLength(1);
        expect(within(list).getByText('Marca Mid 8')).toBeVisible();

        await userEvent.type(
            screen.getByRole('searchbox', {
                name: 'Buscar nos meus alto-falantes',
            }),
            'zzz',
        );
        expect(screen.getByText(/Nenhum resultado para/)).toBeVisible();
    });

    test('usar no projeto aplica o salvo e fecha o diálogo', async () => {
        useSavedDrivers.getState().save(draft('Sub 12', { cutout_m: 0.28 }));
        const onClose = open();

        await userEvent.click(
            screen.getByRole('button', {
                name: 'Usar Marca Sub 12 no projeto',
            }),
        );

        const { data } = activeProjectStore().getState();
        expect(data.driver).toEqual(draft('Sub 12').driver);
        expect(data.driverSource).toEqual({ brand: 'Marca', model: 'Sub 12' });
        expect(data.cutPlan?.cutout_m).toBe(0.28);
        expect(onClose).toHaveBeenCalled();
    });

    test('excluir pede confirmação e Cancelar mantém o item', async () => {
        useSavedDrivers.getState().save(draft('Sub 12'));
        open();

        await userEvent.click(
            screen.getByRole('button', { name: 'Excluir Marca Sub 12' }),
        );
        const confirm = screen.getByRole('alertdialog');
        await userEvent.click(
            within(confirm).getByRole('button', { name: 'Cancelar' }),
        );

        expect(useSavedDrivers.getState().items).toHaveLength(1);

        await userEvent.click(
            screen.getByRole('button', { name: 'Excluir Marca Sub 12' }),
        );
        await userEvent.click(
            within(screen.getByRole('alertdialog')).getByRole('button', {
                name: 'Excluir',
            }),
        );

        expect(useSavedDrivers.getState().items).toHaveLength(0);
        expect(
            await screen.findByText(
                'Você ainda não salvou nenhum alto-falante.',
            ),
        ).toBeVisible();
    });

    test('editar abre o formulário do item e volta à lista ao fechar', async () => {
        useSavedDrivers.getState().save(draft('Sub 12'));
        open();

        await userEvent.click(
            screen.getByRole('button', { name: 'Editar Marca Sub 12' }),
        );

        const form = await screen.findByRole('dialog', {
            name: 'Editar alto-falante',
        });
        await userEvent.click(
            within(form).getByRole('button', { name: 'Cancelar' }),
        );

        expect(
            await screen.findByRole('dialog', { name: 'Meus alto-falantes' }),
        ).toBeVisible();
    });

    test('exportar entrega a lista atual', async () => {
        useSavedDrivers.getState().save(draft('Sub 12'));
        open();

        await userEvent.click(screen.getByRole('button', { name: /Exportar/ }));

        expect(downloadSavedDrivers).toHaveBeenCalledWith(
            useSavedDrivers.getState().items,
        );
    });

    test('importar acrescenta os novos e resume o resultado', async () => {
        open();
        const text = exportSavedDrivers([
            { ...draft('A'), id: 'x', savedAt: '2026-01-01T00:00:00.000Z' },
            { ...draft('B'), id: 'y', savedAt: '2026-01-01T00:00:00.000Z' },
        ]);

        await act(() => upload(text));

        expect(
            await screen.findByText(
                'Importação concluída: 2 adicionados, 0 substituídos, 0 ignorados.',
            ),
        ).toBeVisible();
        expect(useSavedDrivers.getState().items).toHaveLength(2);
    });

    test('importar com repetidos pergunta; "Manter os atuais" ignora', async () => {
        useSavedDrivers.getState().save(draft('A', { depth_m: 0.1 }));
        open();
        const text = exportSavedDrivers([
            {
                ...draft('A', { depth_m: 0.2 }),
                id: 'x',
                savedAt: '2026-01-01T00:00:00.000Z',
            },
            { ...draft('C'), id: 'y', savedAt: '2026-01-01T00:00:00.000Z' },
        ]);

        await act(() => upload(text));
        const ask = await screen.findByRole('alertdialog');
        expect(
            within(ask).getByText(/1 alto-falante do arquivo já está/),
        ).toBeVisible();
        await userEvent.click(
            within(ask).getByRole('button', { name: 'Manter os atuais' }),
        );

        await waitFor(() =>
            expect(useSavedDrivers.getState().items).toHaveLength(2),
        );
        const kept = useSavedDrivers
            .getState()
            .items.find((item) => item.model === 'A');
        expect(kept?.depth_m).toBe(0.1);
        expect(
            await screen.findByText(
                'Importação concluída: 1 adicionados, 0 substituídos, 1 ignorados.',
            ),
        ).toBeVisible();
    });

    test('importar com repetidos e "Substituir" troca os dados', async () => {
        useSavedDrivers.getState().save(draft('A', { depth_m: 0.1 }));
        open();
        const text = exportSavedDrivers([
            {
                ...draft('A', { depth_m: 0.2 }),
                id: 'x',
                savedAt: '2026-01-01T00:00:00.000Z',
            },
        ]);

        await act(() => upload(text));
        await userEvent.click(
            within(await screen.findByRole('alertdialog')).getByRole('button', {
                name: 'Substituir',
            }),
        );

        const [item] = useSavedDrivers.getState().items;
        expect(item.depth_m).toBe(0.2);
    });

    test('arquivo inválido mostra a mensagem do código e não altera a lista', async () => {
        useSavedDrivers.getState().save(draft('A'));
        open();

        await act(() => upload('{ não é json'));

        expect(
            await screen.findByText('O arquivo não é um JSON válido.'),
        ).toBeVisible();
        expect(useSavedDrivers.getState().items).toHaveLength(1);
    });

    test('avisa quando o navegador não guarda dados', () => {
        const spy = vi
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('bloqueado');
            });

        try {
            open();

            expect(screen.getByText(/não deixa guardar dados/)).toBeVisible();
        } finally {
            spy.mockRestore();
        }
    });
});
