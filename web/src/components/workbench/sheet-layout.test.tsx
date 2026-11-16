import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { nestPieces } from '@/cutplan';
import type { Piece, ResolvedSheet } from '@/cutplan';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { SheetLayout } from './sheet-layout';

const SHEET: ResolvedSheet = {
    stock: [{ index: 0, w_m: 2.75, h_m: 1.85 }],
    kerf_m: 0.003,
    rotate: true,
    cut: 'guillotine',
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

        const warning = screen.getByText(
            /Não cabem em nenhuma chapa do estoque:/,
        );
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
            screen.getByText('Nenhuma peça coube no estoque informado.'),
        ).toBeVisible();
    });

    test('estoque: cada chapa diz o item de origem e quantas do item já foram usadas', () => {
        const stock: ResolvedSheet = {
            ...SHEET,
            stock: [
                { index: 0, w_m: 2.75, h_m: 1.85 },
                { index: 1, w_m: 0.9, h_m: 0.6, quantity: 2 },
            ],
        };
        const layout = nestPieces([piece('side', 0.5, 0.4, 2)], stock);
        renderWithProviders(<SheetLayout layout={layout} sheet={stock} />);

        expect(
            screen.getByText(/\(item 2 do estoque\) · 1 de 2/),
        ).toBeVisible();
        expect(screen.getByTestId('by-stock')).toHaveTextContent(
            /Chapas usadas: 1 × 900,0 mm × 600,0 mm \(item 2 do estoque\)/,
        );
    });

    test('peças sem chapa no estoque têm aviso próprio, separado do "não cabe"', () => {
        const stock: ResolvedSheet = {
            ...SHEET,
            stock: [{ index: 0, w_m: 0.9, h_m: 0.6, quantity: 1 }],
        };
        const layout = nestPieces([piece('side', 0.8, 0.5, 2)], stock);
        renderWithProviders(<SheetLayout layout={layout} sheet={stock} />);

        expect(
            screen.getByText(/Faltou chapa no estoque para:/),
        ).toHaveTextContent('Lateral 2');
        expect(screen.queryByText(/Não cabem em nenhuma chapa/)).toBeNull();
    });

    test('corte livre avisa que o plano é para CNC ou tupia', () => {
        const free: ResolvedSheet = { ...SHEET, cut: 'free' };
        const layout = nestPieces([piece('side', 0.5, 0.4, 2)], free);
        renderWithProviders(<SheetLayout layout={layout} sheet={free} />);

        expect(screen.getByText(/corte livre \(CNC ou tupia\)/)).toBeVisible();
        expect(screen.getByTestId('cut-mode')).toHaveTextContent(
            'Tipo de corte: CNC/tupia (livre).',
        );
    });

    test('o resumo diz o tipo de corte (Serra por padrão), também na impressão', () => {
        const layout = nestPieces([piece('side', 0.5, 0.4)], SHEET);
        renderWithProviders(<SheetLayout layout={layout} sheet={SHEET} />);

        expect(screen.getByTestId('cut-mode')).toHaveTextContent(
            'Tipo de corte: Serra (cortes de ponta a ponta).',
        );
    });
});
