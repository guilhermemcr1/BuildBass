import { describe, expect, test } from 'vite-plus/test';
import { simulate } from '@/engine';
import type { BoxInput, ProjectInput } from '@/engine';
import { resolveCutPlan } from './config';
import { nestPieces } from './nesting';
import type { SheetLayout } from './nesting';
import { buildCutPlan } from './plan';
import type { Piece, PieceRole, ResolvedSheet } from './types';

function stockSheet(
    stock: { w_m: number; h_m: number; quantity?: number }[],
    extra: Partial<Omit<ResolvedSheet, 'stock'>> = {},
): ResolvedSheet {
    return {
        stock: stock.map((item, index) => ({ index, ...item })),
        kerf_m: 0.003,
        rotate: true,
        cut: 'guillotine',
        ...extra,
    };
}

const SHEET = stockSheet([{ w_m: 2.75, h_m: 1.85 }]);

function piece(role: PieceRole, w_m: number, h_m: number, quantity = 1): Piece {
    return { role, quantity, w_m, h_m, thickness_m: 0.018, cutouts: [] };
}

const total = (pieces: Piece[]) =>
    pieces.reduce((sum, { quantity }) => sum + quantity, 0);

// Invariantes que valem para qualquer entrada.
function expectValid(
    layout: SheetLayout,
    pieces: Piece[],
    sheet: ResolvedSheet,
) {
    const eps = 1e-9;

    for (const { placements, w_m, h_m, stock } of layout.sheets) {
        const source = sheet.stock.find(({ index }) => index === stock);

        expect(source).toMatchObject({ w_m, h_m });

        for (const p of placements) {
            expect(p.x_m).toBeGreaterThanOrEqual(-eps);
            expect(p.y_m).toBeGreaterThanOrEqual(-eps);
            expect(p.x_m + p.w_m).toBeLessThanOrEqual(w_m + eps);
            expect(p.y_m + p.h_m).toBeLessThanOrEqual(h_m + eps);

            if (!sheet.rotate) {
                expect(p.rotated).toBe(false);
            }
        }

        for (const [index, a] of placements.entries()) {
            for (const b of placements.slice(index + 1)) {
                const apart =
                    a.x_m + a.w_m + sheet.kerf_m <= b.x_m + eps ||
                    b.x_m + b.w_m + sheet.kerf_m <= a.x_m + eps ||
                    a.y_m + a.h_m + sheet.kerf_m <= b.y_m + eps ||
                    b.y_m + b.h_m + sheet.kerf_m <= a.y_m + eps;

                expect(apart).toBe(true);
            }
        }
    }

    const placed = layout.sheets.reduce(
        (sum, { placements }) => sum + placements.length,
        0,
    );

    expect(placed + layout.oversize.length + layout.unplaced.length).toBe(
        total(pieces),
    );
    expect(layout.sheetCount).toBe(layout.sheets.length);

    for (const { index, quantity } of sheet.stock) {
        const used = layout.sheets.filter(
            ({ stock }) => stock === index,
        ).length;

        if (quantity !== undefined) {
            expect(used).toBeLessThanOrEqual(quantity);
        }
    }
}

function plan(box: Partial<BoxInput> = {}) {
    const input: ProjectInput = {
        name: 'p',
        driver: {
            fs_hz: 28,
            qts: 0.38,
            qes: 0.42,
            qms: 4.1,
            vas_m3: 0.085,
            re_ohm: 3.6,
            sd_m2: 0.0491,
            xmax_m: 0.014,
            vd_m3: 0.002,
        },
        drivers: { count: 1, wiring: 'parallel' },
        box: {
            type: 'closed',
            vb_m3: 0.06,
            ql: 7,
            port: { shape: 'round', diameter_m: 0.1, count: 1 },
            ...box,
        },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
    };
    const result = buildCutPlan(
        input,
        simulate(input).results,
        resolveCutPlan({ cutout_m: 0.2 }),
    );

    if (result.status !== 'ready') {
        throw new Error('bloqueado');
    }

    return result.plan;
}

describe('encaixe das peças na chapa', () => {
    test('uma peça cabe numa chapa e o aproveitamento é a área dela', () => {
        const pieces = [piece('front', 0.5, 0.4)];
        const layout = nestPieces(pieces, SHEET);

        expectValid(layout, pieces, SHEET);
        expect(layout.sheetCount).toBe(1);
        expect(layout.sheets[0].placements[0]).toMatchObject({
            role: 'front',
            unit: 1,
            x_m: 0,
            y_m: 0,
            rotated: false,
        });
        expect(layout.utilization).toBeCloseTo((0.5 * 0.4) / (2.75 * 1.85), 12);
        expect(layout.waste_m2).toBeCloseTo(2.75 * 1.85 - 0.2, 12);
    });

    test('peça do tamanho exato da chapa cabe (a perda de serra não a empurra para fora)', () => {
        const pieces = [piece('front', 2.75, 1.85)];
        const layout = nestPieces(pieces, SHEET);

        expectValid(layout, pieces, SHEET);
        expect(layout.oversize).toEqual([]);
        expect(layout.sheetCount).toBe(1);
        expect(layout.utilization).toBeCloseTo(1, 12);
    });

    test('peça maior que a chapa em qualquer orientação vai para "não cabem"', () => {
        const pieces = [piece('front', 3, 2), piece('back', 0.5, 0.5)];
        const layout = nestPieces(pieces, SHEET);

        expectValid(layout, pieces, SHEET);
        expect(layout.oversize).toEqual([{ role: 'front', unit: 1 }]);
        expect(layout.sheetCount).toBe(1);
    });

    test('peça que só cabe girada: cabe com girar, não cabe sem', () => {
        const pieces = [piece('front', 1.8, 2.7)];

        const rotated = nestPieces(pieces, SHEET);
        expectValid(rotated, pieces, SHEET);
        expect(rotated.oversize).toEqual([]);
        expect(rotated.sheets[0].placements[0].rotated).toBe(true);

        const fixed = nestPieces(pieces, { ...SHEET, rotate: false });
        expectValid(fixed, pieces, { ...SHEET, rotate: false });
        expect(fixed.oversize).toEqual([{ role: 'front', unit: 1 }]);
        expect(fixed.sheetCount).toBe(0);
    });

    test('sem girar, o comprimento da peça corre ao longo da largura da chapa', () => {
        const pieces = [piece('front', 2, 0.5)];
        const layout = nestPieces(pieces, { ...SHEET, rotate: false });

        expect(layout.sheets[0].placements[0]).toMatchObject({
            w_m: 2,
            h_m: 0.5,
            rotated: false,
        });
    });

    test('girar só muda o resultado quando precisa', () => {
        const pieces = [
            piece('front', 0.6, 0.4, 3),
            piece('side', 0.5, 0.3, 2),
        ];

        expect(nestPieces(pieces, SHEET)).toEqual(
            nestPieces(pieces, { ...SHEET, rotate: false }),
        );
    });

    test('muitas peças iguais ocupam várias chapas, todas válidas', () => {
        const pieces = [piece('front', 1.2, 0.9, 12)];
        const layout = nestPieces(pieces, SHEET);

        expectValid(layout, pieces, SHEET);
        expect(layout.oversize).toEqual([]);
        expect(layout.sheetCount).toBeGreaterThan(1);
        expect(layout.utilization).toBeGreaterThan(0);
        expect(layout.utilization).toBeLessThanOrEqual(1);
    });

    test('cada cópia de uma peça com quantidade tem o próprio número de unidade', () => {
        const pieces = [piece('side', 0.5, 0.4, 2)];
        const layout = nestPieces(pieces, SHEET);

        expect(
            layout.sheets
                .flatMap(({ placements }) => placements)
                .map(({ role, unit }) => `${role}${unit}`)
                .sort(),
        ).toEqual(['side1', 'side2']);
    });

    test('é determinística', () => {
        const pieces = [
            piece('front', 0.7, 0.9),
            piece('back', 0.7, 0.9),
            piece('top', 0.7, 0.4),
            piece('bottom', 0.7, 0.4),
            piece('side', 0.4, 0.82, 2),
        ];

        expect(nestPieces(pieces, SHEET)).toEqual(nestPieces(pieces, SHEET));
    });

    test.each([
        ['selada', {}],
        ['dutada', { type: 'vented', fb_hz: 35 }],
        ['bandpass', { type: 'bandpass', vr_m3: 0.04, vf_m3: 0.03 }],
    ] as [string, Partial<BoxInput>][])(
        'plano real de %s cabe numa chapa comum de 2,75 × 1,85 m',
        (_name, box) => {
            const { pieces } = plan(box);
            const layout = nestPieces(pieces, SHEET);

            expectValid(layout, pieces, SHEET);
            expect(layout.oversize).toEqual([]);
            expect(layout.utilization).toBeGreaterThan(0);
            expect(layout.utilization).toBeLessThanOrEqual(1);
        },
    );

    test('chapa pequena: o plano real lista as peças que não cabem e coloca o resto', () => {
        const { pieces } = plan();
        const small = stockSheet([{ w_m: 0.3, h_m: 0.3 }]);
        const layout = nestPieces(pieces, small);

        expectValid(layout, pieces, small);
        expect(layout.oversize.length).toBeGreaterThan(0);
    });

    test('a perda de serra afasta as peças vizinhas', () => {
        const pieces = [piece('front', 1, 1, 2)];
        const wide = { ...SHEET, kerf_m: 0.02 };
        const layout = nestPieces(pieces, wide);

        expectValid(layout, pieces, wide);
    });

    test('sem peças não há chapas', () => {
        expect(nestPieces([], SHEET)).toMatchObject({
            sheets: [],
            oversize: [],
            sheetCount: 0,
            utilization: 0,
            waste_m2: 0,
        });
    });
});
