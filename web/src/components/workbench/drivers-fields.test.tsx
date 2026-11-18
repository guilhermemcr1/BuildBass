import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { DriversFields } from './drivers-fields';

const project = () => activeProjectStore().getState();

function withVariant(variant: string) {
    act(() => project().setDriverIdentity({ brand: 'Bomber', variant }));
}

describe('DriversFields — bobina dupla', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('bobina simples: sem selo nem ligação das bobinas, com a carga', () => {
        renderWithProviders(<DriversFields />);
        withVariant('4 Ω');

        expect(screen.queryByText('Bobina dupla')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('radiogroup', { name: /Ligação das bobinas/ }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByText(/Carga nominal no amplificador/),
        ).toHaveTextContent('4 Ω');
    });

    test('4+4 Ω: selo, série 8 Ω por padrão e paralelo 2 Ω gravado no projeto', async () => {
        renderWithProviders(<DriversFields />);
        withVariant('4+4 Ω');

        expect(screen.getByText('Bobina dupla')).toBeInTheDocument();
        expect(
            screen.getByRole('radio', { name: 'Série · 8 Ω' }),
        ).toBeChecked();
        expect(screen.getByText(/Carga nominal/)).toHaveTextContent('8 Ω');

        await userEvent.click(
            screen.getByRole('radio', { name: 'Paralelo · 2 Ω' }),
        );

        expect(project().data.drivers.coil_wiring).toBe('parallel');
        expect(screen.getByText(/Carga nominal/)).toHaveTextContent('2 Ω');
    });

    test('a carga junta a ligação das bobinas com a dos alto-falantes', async () => {
        renderWithProviders(<DriversFields />);
        withVariant('4+4 Ω');
        act(() =>
            project().setDrivers({
                count: 2,
                wiring: 'series',
                coil_wiring: 'parallel',
            }),
        );

        // 2 Ω por alto-falante, dois em série.
        expect(screen.getByText(/Carga nominal/)).toHaveTextContent('4 Ω');
    });
});
