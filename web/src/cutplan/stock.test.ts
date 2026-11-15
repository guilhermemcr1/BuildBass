import { describe, expect, test } from 'vite-plus/test';
import { MAX_STOCK_ITEMS, stockItems, stockOf, withStock } from './stock';
import type { SheetConfig } from './types';

describe('estoque de chapas (specs/012, R1)', () => {
    test('sem chapa, a lista é vazia', () => {
        expect(stockItems(undefined)).toEqual([]);
        expect(stockOf(undefined)).toEqual([]);
    });

    test('a raiz é o 1º item e `more` os demais, rascunhos incluídos', () => {
        const sheet: SheetConfig = {
            w_m: 2.75,
            h_m: 1.85,
            kerf_m: 0.004,
            more: [{ w_m: 1.2, h_m: 0.6, quantity: 2 }, { w_m: 0.5 }],
        };

        expect(stockItems(sheet)).toEqual([
            { w_m: 2.75, h_m: 1.85 },
            { w_m: 1.2, h_m: 0.6, quantity: 2 },
            { w_m: 0.5 },
        ]);
    });

    test('stockOf fica só com itens completos e guarda a posição na lista', () => {
        const sheet: SheetConfig = {
            w_m: 2.75,
            more: [
                { w_m: 1.2, h_m: 0.6, quantity: 2 },
                { w_m: 0.5, h_m: 0.4 },
            ],
        };

        expect(stockOf(sheet)).toEqual([
            { index: 1, w_m: 1.2, h_m: 0.6, quantity: 2 },
            { index: 2, w_m: 0.5, h_m: 0.4 },
        ]);
    });

    test('withStock grava a raiz e `more`, preservando perda de serra, rotação e corte', () => {
        const sheet: SheetConfig = {
            w_m: 1,
            h_m: 1,
            kerf_m: 0.002,
            rotate: false,
            cut: 'free',
        };

        expect(
            withStock(sheet, [
                { w_m: 2.75, h_m: 1.85, quantity: 1 },
                { w_m: 1.2, h_m: 0.6 },
            ]),
        ).toEqual({
            w_m: 2.75,
            h_m: 1.85,
            kerf_m: 0.002,
            rotate: false,
            quantity: 1,
            more: [{ w_m: 1.2, h_m: 0.6 }],
            cut: 'free',
        });
    });

    test('um item só não grava `more`, e lista vazia apaga a chapa', () => {
        expect(withStock(undefined, [{ w_m: 2.75, h_m: 1.85 }])).toEqual({
            w_m: 2.75,
            h_m: 1.85,
        });
        expect(withStock({ w_m: 1, h_m: 1, cut: 'free' }, [])).toBeUndefined();
    });

    test(`limita a ${MAX_STOCK_ITEMS} itens`, () => {
        const items = Array.from({ length: 12 }, () => ({ w_m: 1, h_m: 1 }));

        expect(stockItems(withStock(undefined, items))).toHaveLength(
            MAX_STOCK_ITEMS,
        );
    });

    test('ida e volta preserva a configuração', () => {
        const sheet: SheetConfig = {
            w_m: 2.75,
            h_m: 1.85,
            kerf_m: 0.003,
            rotate: true,
            quantity: 3,
            more: [{ w_m: 1.2, h_m: 0.6, quantity: 2 }],
            cut: 'guillotine',
        };

        expect(withStock(sheet, stockItems(sheet))).toEqual(sheet);
    });
});
