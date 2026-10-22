import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { nestPieces } from '@/cutplan';
import type { Piece, ResolvedSheet } from '@/cutplan';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { SheetLayout } from './sheet-layout';

const SHEET: ResolvedSheet = {
    w_m: 2.75,
    h_m: 1.85,
    kerf_m: 0.003,
    rotate: true,
};

function piece(
    role: Piece['role'],
    w_m: number,
    h_m: number,
    quantity = 1,
): Piece {
    return { role, quantity, w_m, h_m, thickness_m: 0.018, cutouts: [] };
}

describe('SheetLayout', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('uma figura por chapa, com o resumo de aproveitamento e sobra', () => {
        const pieces = [piece('front', 1.2, 0.9, 12)];
        const layout = nestPieces(pieces, SHEET);
        renderWithProviders(<SheetLayout layout={layout} sheet={SHEET} />);

        expect(screen.getAllByRole('img')).toHaveLength(layout.sheetCount);
        expect(screen.getByText(/aproveitamento de .*sobra de/)).toBeVisible();
        expect(
            screen.getByText(new RegExp(`Chapa 1 de ${layout.sheetCount}`)),
        ).toBeVisible();
    });

    test('cada peça colocada tem rótulo e medidas na lista para leitor de tela', () => {
        const layout = nestPieces([piece('side', 0.5, 0.4, 2)], SHEET);
        const { container } = renderWithProviders(
            <SheetLayout layout={layout} sheet={SHEET} />,
        );

        const items = container.querySelectorAll('ul.sr-only li');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent(/Lateral 1: .* × /);
        expect(container.querySelectorAll('[data-piece]')).toHaveLength(2);
    });

    test('peça girada leva a marca "girada"', () => {
        const layout = nestPieces([piece('front', 1.8, 2.7)], SHEET);
        const { container } = renderWithProviders(
            <SheetLayout layout={layout} sheet={SHEET} />,
        );

        expect(container.querySelector('[data-rotated="true"]')).not.toBeNull();
        expect(container.querySelector('ul.sr-only li')).toHaveTextContent(
            /girada/,
        );
    });

    test('peça que não cabe vira aviso nomeando a peça', () => {
        const layout = nestPieces(
            [piece('front', 3, 2), piece('back', 0.5, 0.5)],
            SHEET,
        );
        renderWithProviders(<SheetLayout layout={layout} sheet={SHEET} />);

        const warning = screen.getByText(/Não cabem na chapa informada:/);
        expect(warning).toHaveTextContent('Frente 1');
        expect(
            within(warning.parentElement ?? warning).queryByText(/Fundo/),
        ).toBeNull();
    });

    test('quando nada cabe mostra a mensagem e nenhuma figura', () => {
        const layout = nestPieces([piece('front', 3, 2)], SHEET);
        renderWithProviders(<SheetLayout layout={layout} sheet={SHEET} />);

        expect(screen.queryByRole('img')).toBeNull();
        expect(
            screen.getByText('Nenhuma peça coube na chapa informada.'),
        ).toBeVisible();
    });
});
