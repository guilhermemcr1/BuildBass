import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { setStock } from '@/lib/project/fields';
import type { StockItem } from '@/cutplan';
import { useExpanded } from '@/stores/expanded';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { StockList, StockQuantities } from './stock-list';

function seed(items: StockItem[]) {
    act(() =>
        activeProjectStore()
            .getState()
            .apply((data) => setStock(data, items)),
    );
}

const sheet = () => activeProjectStore().getState().data.cutPlan?.sheet;

function renderStock() {
    return renderWithProviders(
        <>
            <StockList />
            <StockQuantities />
        </>,
    );
}

describe('StockList', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
        useExpanded.getState().expandAll();
    });

    test('sem chapa mostra um item vazio, sem botões de mover ou remover', () => {
        renderStock();

        const list = screen.getByRole('list', { name: 'Chapas disponíveis' });

        expect(within(list).getAllByRole('listitem')).toHaveLength(1);
        expect(
            within(list).getByRole('textbox', { name: /Largura da chapa/ }),
        ).toHaveValue('');
        expect(screen.queryByRole('button', { name: /Remover/ })).toBeNull();
    });

    test('digitar no item vazio começa o estoque, como a chapa única', async () => {
        renderStock();

        await userEvent.type(
            screen.getByRole('textbox', { name: /Largura da chapa/ }),
            '2750{Tab}',
        );

        expect(sheet()).toEqual({ w_m: 2.75 });
    });

    test('adicionar, mover e remover itens grava a lista inteira', async () => {
        seed([{ w_m: 2.75, h_m: 1.85 }]);
        renderStock();

        await userEvent.click(
            screen.getByRole('button', { name: 'Adicionar chapa' }),
        );
        await userEvent.type(
            screen.getByRole('textbox', { name: /Item 2:.*Largura da chapa/ }),
            '900{Tab}',
        );
        await userEvent.type(
            screen.getByRole('textbox', { name: /Item 2:.*Altura da chapa/ }),
            '600{Tab}',
        );

        expect(sheet()).toEqual({
            w_m: 2.75,
            h_m: 1.85,
            more: [{ w_m: 0.9, h_m: 0.6 }],
        });

        await userEvent.click(
            screen.getByRole('button', { name: 'Subir o item 2' }),
        );

        expect(sheet()).toEqual({
            w_m: 0.9,
            h_m: 0.6,
            more: [{ w_m: 2.75, h_m: 1.85 }],
        });
        expect(
            screen.getByRole('button', { name: 'Subir o item 1' }),
        ).toBeDisabled();
        expect(
            screen.getByRole('button', { name: 'Descer o item 2' }),
        ).toBeDisabled();

        await userEvent.click(
            screen.getByRole('button', { name: 'Remover o item 1' }),
        );

        expect(sheet()).toEqual({ w_m: 2.75, h_m: 1.85 });
    });

    test('quantidade vazia é "sem limite" e só aceita inteiro de 1 a 99', async () => {
        seed([
            { w_m: 2.75, h_m: 1.85 },
            { w_m: 0.9, h_m: 0.6 },
        ]);
        renderStock();

        expect(screen.getAllByText('Sem limite')).toHaveLength(2);

        const quantity = screen.getByRole('textbox', {
            name: /Item 2:.*Quantidade/,
        });

        await userEvent.type(quantity, '2{Tab}');

        expect(sheet()?.more).toEqual([{ w_m: 0.9, h_m: 0.6, quantity: 2 }]);
        expect(screen.getAllByText('Sem limite')).toHaveLength(1);

        await userEvent.clear(quantity);
        await userEvent.type(quantity, '100{Tab}');

        expect(sheet()?.more).toEqual([{ w_m: 0.9, h_m: 0.6, quantity: 2 }]);
    });

    test('no 10º item o botão de adicionar se desativa com o motivo', () => {
        seed(Array.from({ length: 10 }, () => ({ w_m: 0.9, h_m: 0.6 })));
        renderStock();

        const add = screen.getByRole('button', { name: 'Adicionar chapa' });

        expect(add).toBeDisabled();
        expect(add).toHaveAccessibleDescription(
            'O estoque aceita até 10 chapas.',
        );
    });
});
