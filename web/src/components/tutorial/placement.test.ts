import { describe, expect, test } from 'vite-plus/test';
import { placeCard } from './placement';

const VIEW = { width: 1200, height: 800 };
const CARD = { width: 340, height: 200 };

describe('placeCard', () => {
    test('sem alvo o cartão fica no centro da tela', () => {
        expect(placeCard(null, CARD, VIEW)).toEqual({
            left: 430,
            top: 300,
            placement: 'center',
        });
    });

    test('usa o primeiro lado preferido que cabe', () => {
        const target = { left: 100, top: 100, width: 300, height: 100 };

        expect(
            placeCard(target, CARD, VIEW, ['right', 'bottom']),
        ).toMatchObject({
            placement: 'right',
            left: 416,
        });
        expect(
            placeCard(target, CARD, VIEW, ['bottom', 'right']),
        ).toMatchObject({
            placement: 'bottom',
            top: 216,
        });
    });

    test('pula o lado que não cabe', () => {
        const target = { left: 900, top: 100, width: 250, height: 100 };

        expect(placeCard(target, CARD, VIEW, ['right', 'left'])).toMatchObject({
            placement: 'left',
            left: 900 - 16 - 340,
        });
    });

    test('alvo que ocupa a tela toda põe o cartão sobre ele, dentro da tela', () => {
        const target = { left: 0, top: 0, width: 1200, height: 1500 };
        const placed = placeCard(target, CARD, VIEW);

        expect(placed.placement).toBe('inside');
        expect(placed.left).toBeGreaterThanOrEqual(12);
        expect(placed.left + CARD.width).toBeLessThanOrEqual(VIEW.width - 12);
        expect(placed.top + CARD.height).toBeLessThanOrEqual(VIEW.height - 12);
    });

    test('o cartão nunca sai pelas bordas ao centrar num alvo no canto', () => {
        const target = { left: 0, top: 0, width: 80, height: 40 };
        const placed = placeCard(target, CARD, VIEW, ['bottom']);

        expect(placed.left).toBeGreaterThanOrEqual(12);
        expect(placed.top).toBeGreaterThanOrEqual(12);
    });
});
