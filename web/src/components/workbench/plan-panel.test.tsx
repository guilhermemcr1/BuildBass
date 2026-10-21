import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { writeField } from '@/lib/project/fields';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { PlanPanel } from './plan-panel';

function setField(
    key: Parameters<typeof writeField>[1],
    si: number | undefined,
) {
    act(() =>
        activeProjectStore()
            .getState()
            .apply((data) => writeField(data, key, si)),
    );
}

describe('PlanPanel', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('sem volume avisa o que falta, citando o símbolo do campo', () => {
        setField('vb_m3', undefined);
        renderWithProviders(<PlanPanel />);

        expect(
            screen.getByText(/Faltam parâmetros para o plano: .*Vb/),
        ).toBeVisible();
        expect(screen.queryByRole('table')).toBeNull();
    });

    test('com volume mostra dimensões e a lista de peças', () => {
        setField('vb_m3', 0.06);
        renderWithProviders(<PlanPanel />);

        expect(
            screen.getByRole('region', { name: 'Plano de corte' }),
        ).toBeVisible();
        expect(screen.getByRole('table')).toBeVisible();
        expect(screen.getByRole('row', { name: /Frente/ })).toBeVisible();
        expect(screen.getByText(/Internas · Largura/)).toBeVisible();
        expect(screen.getByText(/Externas · Altura/)).toBeVisible();
    });

    test('mudar a espessura atualiza a tabela', async () => {
        setField('vb_m3', 0.06);
        renderWithProviders(<PlanPanel />);
        const row = () => screen.getByRole('row', { name: /Lateral/ });

        expect(within(row()).getAllByRole('cell')[4]).toHaveTextContent('18');

        const field = screen.getByRole('textbox', { name: /Espessura/ });
        await userEvent.clear(field);
        await userEvent.type(field, '25{Enter}');

        expect(within(row()).getAllByRole('cell')[4]).toHaveTextContent('25');
    });

    test('proporção própria mostra os três lados para editar', async () => {
        setField('vb_m3', 0.06);
        renderWithProviders(<PlanPanel />);

        expect(screen.queryByRole('textbox', { name: /^Rh/ })).toBeNull();
        expect(
            screen.getByText(/Altura : largura : profundidade/),
        ).toBeVisible();

        await userEvent.click(
            screen.getByRole('button', { name: /Proporção/ }),
        );
        await userEvent.click(screen.getByRole('option', { name: 'Própria' }));

        expect(screen.getByRole('textbox', { name: /^Rh/ })).toBeVisible();
        expect(screen.getByRole('textbox', { name: /^Rw/ })).toBeVisible();
        expect(screen.getByRole('textbox', { name: /^Rd/ })).toBeVisible();
    });
});
