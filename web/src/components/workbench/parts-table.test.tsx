import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Plan } from '@/cutplan';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { PartsTable } from './parts-table';

const PLAN: Plan = {
    boxType: 'vented',
    thickness_m: 0.018,
    dimensions: {
        internal: { w_m: 0.4, h_m: 0.6, d_m: 0.25 },
        external: { w_m: 0.436, h_m: 0.636, d_m: 0.286 },
    },
    pieces: [
        {
            role: 'front',
            quantity: 1,
            w_m: 0.436,
            h_m: 0.636,
            thickness_m: 0.018,
            cutouts: [
                { kind: 'driver', shape: 'round', diameter_m: 0.285 },
                { kind: 'driver', shape: 'round', diameter_m: 0.285 },
                { kind: 'port', shape: 'round', diameter_m: 0.1 },
            ],
        },
        {
            role: 'side',
            quantity: 2,
            w_m: 0.25,
            h_m: 0.6,
            thickness_m: 0.018,
            cutouts: [],
        },
    ],
    volume: { chambers: [] },
    warnings: [],
};

describe('PartsTable', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('tem legenda, cabeçalhos de coluna e uma linha por peça', () => {
        renderWithProviders(<PartsTable plan={PLAN} name="Sub 12" />);

        expect(
            screen.getByRole('table', { name: 'Lista de corte de Sub 12' }),
        ).toBeInTheDocument();

        for (const name of [
            'Peça',
            'Posição',
            'Qtd',
            'Comprimento',
            'Largura',
            'Espessura',
            'Recortes',
        ]) {
            expect(
                screen.getByRole('columnheader', { name }),
            ).toBeInTheDocument();
        }

        expect(screen.getAllByRole('row')).toHaveLength(3);
    });

    test('comprimento é o maior lado e largura o menor', () => {
        renderWithProviders(<PartsTable plan={PLAN} name="x" />);

        const side = screen.getByRole('row', { name: /Lateral/ });
        const cells = within(side).getAllByRole('cell');

        expect(cells[1]).toHaveTextContent('2');
        expect(cells[2]).toHaveTextContent('600');
        expect(cells[3]).toHaveTextContent('250');
        expect(cells[4]).toHaveTextContent('18');
    });

    test('recortes iguais viram um item com a quantidade', () => {
        renderWithProviders(<PartsTable plan={PLAN} name="x" />);

        const front = screen.getByRole('row', { name: /Frente/ });

        expect(within(front).getByText(/Driver Ø .*285.* ×2/)).toBeVisible();
        expect(within(front).getByText(/Duto Ø .*100/)).toBeVisible();
    });

    test('peça sem recorte mostra traço e diâmetro desconhecido pede informação', () => {
        const pending: Plan = {
            ...PLAN,
            pieces: [
                {
                    ...PLAN.pieces[0],
                    cutouts: [{ kind: 'driver', shape: 'round' }],
                },
                PLAN.pieces[1],
            ],
        };
        renderWithProviders(<PartsTable plan={pending} name="x" />);

        expect(screen.getByText(/diâmetro a informar/)).toBeVisible();
        expect(
            within(screen.getByRole('row', { name: /Lateral/ })).getByText('—'),
        ).toBeVisible();
    });

    test('mostra a convenção de montagem e, na bandpass, a da divisória', () => {
        const { unmount } = renderWithProviders(
            <PartsTable plan={PLAN} name="x" />,
        );

        expect(screen.getByText(/Convenção de montagem/)).toBeVisible();
        expect(screen.queryByText(/A divisória fica/)).toBeNull();
        unmount();

        renderWithProviders(
            <PartsTable
                plan={{
                    ...PLAN,
                    pieces: [
                        ...PLAN.pieces,
                        {
                            role: 'divider',
                            quantity: 1,
                            w_m: 0.4,
                            h_m: 0.6,
                            thickness_m: 0.018,
                            cutouts: [],
                        },
                    ],
                }}
                name="x"
            />,
        );

        expect(screen.getByText(/A divisória fica/)).toBeVisible();
    });

    test('no sistema imperial mostra polegadas', () => {
        usePreferences.setState({ unitSystem: 'imperial' });
        renderWithProviders(<PartsTable plan={PLAN} name="x" />);

        const side = screen.getByRole('row', { name: /Lateral/ });

        expect(within(side).getAllByRole('cell')[2]).toHaveTextContent(/in/);
    });
});
