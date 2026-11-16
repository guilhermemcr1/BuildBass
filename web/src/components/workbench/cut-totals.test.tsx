import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Plan } from '@/cutplan';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { CutTotals } from './cut-totals';

const PLAN: Plan = {
    boxType: 'closed',
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
            cutouts: [],
        },
        {
            role: 'back',
            quantity: 1,
            w_m: 0.436,
            h_m: 0.636,
            thickness_m: 0.018,
            cutouts: [],
        },
        {
            role: 'top',
            quantity: 1,
            w_m: 0.436,
            h_m: 0.25,
            thickness_m: 0.018,
            cutouts: [],
        },
        {
            role: 'bottom',
            quantity: 1,
            w_m: 0.436,
            h_m: 0.25,
            thickness_m: 0.018,
            cutouts: [],
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

describe('CutTotals', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('mostra as bases "sem" e "com" desconto do MDF e a diferença, por peças, área e corte', () => {
        renderWithProviders(<CutTotals plan={PLAN} />);
        const table = screen.getByRole('table', { name: 'Corte total' });

        expect(
            within(table)
                .getAllByRole('columnheader')
                .map((cell) => cell.textContent),
        ).toEqual(['Corte total', 'Peças', 'Área', 'Corte']);
        const rows = within(table).getAllByRole('row').slice(1);

        expect(
            rows.map(
                (row) => within(row).getAllByRole('rowheader')[0].textContent,
            ),
        ).toEqual([
            'Medidas internas (sem a espessura)',
            'Peças prontas (com a espessura)',
            'O que a espessura acrescenta',
        ]);
        // 6 peças nas duas bases; a diferença de peças é zero.
        expect(within(rows[0]).getAllByRole('cell')[0]).toHaveTextContent('6');
        expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent('6');
        expect(within(rows[2]).getAllByRole('cell')[0]).toHaveTextContent('0');
    });

    test('a explicação do desconto fica visível', () => {
        renderWithProviders(<CutTotals plan={PLAN} />);

        expect(screen.getByText(/a espessura somada/i)).toBeVisible();
    });
});
