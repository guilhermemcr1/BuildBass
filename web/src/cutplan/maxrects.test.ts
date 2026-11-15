import { describe, expect, test } from 'vite-plus/test';
import { maxRectsBin } from './maxrects';
import type { FreeChoice, PackItem, Rect } from './maxrects';
import type { Placement } from './types';

const CHOICES: FreeChoice[] = ['bssf', 'baf', 'bl'];
const KERF = 0.003;
const EPS = 1e-9;

function items(count: number): PackItem[] {
    return Array.from({ length: count }, (_, index) => ({
        role: 'side',
        unit: index + 1,
        w_m: 0.15 + ((index * 37) % 50) / 100,
        h_m: 0.1 + ((index * 53) % 40) / 100,
    }));
}

function pack(choice: FreeChoice, rotate = true, list = items(30)) {
    const bin = maxRectsBin(1.83, 1.22, KERF, rotate, choice);

    for (const item of list) {
        bin.place(item);
    }

    return bin;
}

// Com a perda de serra, cada peça ocupa (w + kerf) × (h + kerf).
const area = (p: Placement): Rect => ({
    x: p.x_m,
    y: p.y_m,
    w: p.w_m + KERF,
    h: p.h_m + KERF,
});

const overlap = (a: Rect, b: Rect) =>
    a.x < b.x + b.w - EPS &&
    b.x < a.x + a.w - EPS &&
    a.y < b.y + b.h - EPS &&
    b.y < a.y + a.h - EPS;

const inside = (outer: Rect, inner: Rect) =>
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.w <= outer.x + outer.w + EPS &&
    inner.y + inner.h <= outer.y + outer.h + EPS;

describe('maxRectsBin (specs/012, R3)', () => {
    test.each(CHOICES)(
        '%s: peças dentro da chapa e sem sobreposição, contando a perda de serra',
        (choice) => {
            const { placements } = pack(choice);

            expect(placements.length).toBeGreaterThan(5);

            for (const placement of placements) {
                expect(placement.x_m).toBeGreaterThanOrEqual(-EPS);
                expect(placement.y_m).toBeGreaterThanOrEqual(-EPS);
                expect(placement.x_m + placement.w_m).toBeLessThanOrEqual(
                    1.83 + EPS,
                );
                expect(placement.y_m + placement.h_m).toBeLessThanOrEqual(
                    1.22 + EPS,
                );
            }

            placements.forEach((a, index) => {
                for (const b of placements.slice(index + 1)) {
                    expect(overlap(area(a), area(b))).toBe(false);
                }
            });
        },
    );

    test.each(CHOICES)('%s: sem girar, nenhuma peça sai girada', (choice) => {
        expect(
            pack(choice, false).placements.every(({ rotated }) => !rotated),
        ).toBe(true);
    });

    test.each(CHOICES)('%s: determinista', (choice) => {
        expect(pack(choice).placements).toEqual(pack(choice).placements);
    });

    test('peça do tamanho exato da chapa cabe; um fio maior não', () => {
        const exact = maxRectsBin(1.2, 0.9, KERF, true, 'bssf');

        expect(
            exact.place({ role: 'front', unit: 1, w_m: 1.2, h_m: 0.9 }),
        ).toBe(true);
        expect(
            exact.place({ role: 'front', unit: 2, w_m: 0.01, h_m: 0.01 }),
        ).toBe(false);

        const larger = maxRectsBin(1.2, 0.9, KERF, true, 'bssf');

        expect(
            larger.place({ role: 'front', unit: 1, w_m: 1.2001, h_m: 0.9 }),
        ).toBe(false);
    });

    test('girar deixa entrar a peça em pé na chapa deitada', () => {
        const bin = maxRectsBin(1.2, 0.9, KERF, true, 'baf');

        expect(bin.place({ role: 'side', unit: 1, w_m: 0.8, h_m: 1.1 })).toBe(
            true,
        );
        expect(bin.placements[0].rotated).toBe(true);
        expect(
            maxRectsBin(1.2, 0.9, KERF, false, 'baf').place({
                role: 'side',
                unit: 1,
                w_m: 0.8,
                h_m: 1.1,
            }),
        ).toBe(false);
    });

    test.each(CHOICES)(
        '%s: os livres não cruzam peças e nenhum está contido em outro',
        (choice) => {
            const bin = pack(choice);
            const free = bin.freeRects();
            const used = bin.placements.map(area);

            for (const rect of free) {
                expect(used.some((piece) => overlap(piece, rect))).toBe(false);
            }

            free.forEach((rect, index) => {
                for (const [j, other] of free.entries()) {
                    if (j !== index) {
                        expect(inside(other, rect)).toBe(false);
                    }
                }
            });
        },
    );
});
