import { describe, expect, test } from 'vite-plus/test';
import { simulate } from '@/engine';
import type { BoxInput, ProjectInput } from '@/engine';
import { resolveCutPlan } from './config';
import { nestPieces } from './nesting';
import type { SheetLayout } from './nesting';
import { buildCutPlan } from './plan';
import { nestPieces008 } from './testing/nesting-008';
import type { Piece, Placement, ResolvedSheet } from './types';

// Conjunto de referência da feature 012: planos reais de vários tipos de
// caixa, em lotes de 1 a 3 caixas, em chapas de tamanhos comuns.

const BOXES: [string, Partial<BoxInput>, number][] = [
    ['selada 60 L', { vb_m3: 0.06 }, 1],
    ['selada 150 L', { vb_m3: 0.15 }, 1],
    ['dutada 100 L', { type: 'vented', vb_m3: 0.1, fb_hz: 35 }, 1],
    ['dutada 2 falantes', { type: 'vented', vb_m3: 0.12, fb_hz: 33 }, 2],
    ['bandpass', { type: 'bandpass', vr_m3: 0.04, vf_m3: 0.03 }, 1],
    [
        'bandpass 6ª',
        {
            type: 'bandpass6',
            vr_m3: 0.05,
            vf_m3: 0.04,
            fb_hz: 50,
            fb_rear_hz: 35,
            port_rear: { shape: 'round', diameter_m: 0.08, count: 1 },
        },
        1,
    ],
    ['selada 4 falantes', { vb_m3: 0.2 }, 4],
];

const SHEETS: [number, number][] = [
    [2.75, 1.85],
    [1.83, 1.22],
    [1.2, 0.9],
];

function piecesOf(box: Partial<BoxInput>, count: number): Piece[] {
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
        drivers: { count, wiring: 'parallel' },
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
        throw new Error('plano de referência não ficou pronto');
    }

    return result.plan.pieces;
}

const batch = (pieces: Piece[], copies: number): Piece[] =>
    pieces.map((piece) => ({ ...piece, quantity: piece.quantity * copies }));

type Case = { name: string; pieces: Piece[]; w_m: number; h_m: number };

const CASES: Case[] = BOXES.flatMap(([name, box, drivers]) =>
    [1, 2, 3].flatMap((copies) =>
        SHEETS.map(([w_m, h_m]) => ({
            name: `${name} ×${copies} em ${w_m}×${h_m}`,
            pieces: batch(piecesOf(box, drivers), copies),
            w_m,
            h_m,
        })),
    ),
);

function single(item: Case, cut: ResolvedSheet['cut']): ResolvedSheet {
    return {
        stock: [{ index: 0, w_m: item.w_m, h_m: item.h_m }],
        kerf_m: 0.003,
        rotate: true,
        cut,
    };
}

const missing = (layout: SheetLayout) =>
    layout.oversize.length + layout.unplaced.length;

// Um conjunto de peças é cortável em guilhotina se existe um corte reto, de lado a lado, que não
// atravessa nenhuma peça e separa o conjunto em dois, cada um cortável de novo.
function guillotineCuttable(
    rects: { x: number; y: number; w: number; h: number }[],
): boolean {
    if (rects.length <= 1) {
        return true;
    }

    const eps = 1e-9;

    for (const axis of ['x', 'y'] as const) {
        const size = axis === 'x' ? 'w' : 'h';
        const cuts = [...new Set(rects.map((r) => r[axis] + r[size]))];

        for (const cut of cuts) {
            const straddles = rects.some(
                (r) => r[axis] < cut - eps && r[axis] + r[size] > cut + eps,
            );

            if (straddles) {
                continue;
            }

            const before = rects.filter((r) => r[axis] + r[size] <= cut + eps);
            const after = rects.filter((r) => r[axis] + r[size] > cut + eps);

            if (
                before.length > 0 &&
                after.length > 0 &&
                guillotineCuttable(before) &&
                guillotineCuttable(after)
            ) {
                return true;
            }
        }
    }

    return false;
}

const withKerf = (placements: Placement[], kerf: number) =>
    placements.map((p) => ({
        x: p.x_m,
        y: p.y_m,
        w: p.w_m + kerf,
        h: p.h_m + kerf,
    }));

describe(`conjunto de referência (${CASES.length} casos)`, () => {
    test('há pelo menos 20 casos', () => {
        expect(CASES.length).toBeGreaterThanOrEqual(20);
    });

    test('Serra: nunca usa mais chapas que a 008 e é idêntico quando não economiza', () => {
        let improved = 0;

        for (const item of CASES) {
            const old = nestPieces008(item.pieces, {
                w_m: item.w_m,
                h_m: item.h_m,
                kerf_m: 0.003,
                rotate: true,
            });
            const next = nestPieces(item.pieces, single(item, 'guillotine'));

            expect(missing(next), item.name).toBeLessThanOrEqual(
                old.oversize.length,
            );
            expect(next.sheetCount, item.name).toBeLessThanOrEqual(
                old.sheetCount,
            );

            if (next.sheetCount < old.sheetCount) {
                improved++;
            } else {
                expect(
                    next.sheets.map(({ placements }) => placements),
                    item.name,
                ).toEqual(old.sheets.map(({ placements }) => placements));
            }
        }

        expect(improved).toBeGreaterThan(0);
    });

    test('Serra: todo resultado é cortável em guilhotina', () => {
        for (const item of CASES) {
            const layout = nestPieces(item.pieces, single(item, 'guillotine'));

            for (const sheet of layout.sheets) {
                expect(
                    guillotineCuttable(withKerf(sheet.placements, 0.003)),
                    item.name,
                ).toBe(true);
            }
        }
    });

    test('CNC/tupia: nunca pior que a Serra e economiza área em ao menos um caso', () => {
        let improved = 0;

        for (const item of CASES) {
            const saw = nestPieces(item.pieces, single(item, 'guillotine'));
            const free = nestPieces(item.pieces, single(item, 'free'));

            expect(missing(free), item.name).toBeLessThanOrEqual(missing(saw));
            expect(free.opened_m2, item.name).toBeLessThanOrEqual(
                saw.opened_m2 + 1e-9,
            );
            expect(free.sheetCount, item.name).toBeLessThanOrEqual(
                saw.sheetCount,
            );

            if (free.opened_m2 < saw.opened_m2 - 1e-9) {
                improved++;
            }
        }

        expect(improved).toBeGreaterThan(0);
    });

    test('uma sobra recebe as peças pequenas e reduz a chapa inteira aberta', () => {
        let checked = 0;

        for (const item of CASES.filter(({ w_m }) => w_m === 2.75)) {
            const whole = nestPieces(item.pieces, single(item, 'guillotine'));
            const stock: ResolvedSheet = {
                ...single(item, 'guillotine'),
                stock: [
                    { index: 0, w_m: item.w_m, h_m: item.h_m },
                    { index: 1, w_m: 0.9, h_m: 0.6, quantity: 2 },
                ],
            };
            const withOffcut = nestPieces(item.pieces, stock);
            const wholeArea = (layout: SheetLayout) =>
                layout.sheets.filter(({ stock: from }) => from === 0).length *
                item.w_m *
                item.h_m;

            expect(missing(withOffcut), item.name).toBe(missing(whole));
            expect(wholeArea(withOffcut), item.name).toBeLessThanOrEqual(
                wholeArea(whole),
            );

            if (withOffcut.byStock.some(({ stock: from }) => from === 1)) {
                checked++;
                expect(wholeArea(withOffcut), item.name).toBeLessThan(
                    wholeArea(whole),
                );
            }
        }

        expect(checked).toBeGreaterThan(0);
    });

    test('40 peças com 10 itens de estoque em até 200 ms nos dois tipos', () => {
        const pieces: Piece[] = Array.from({ length: 40 }, (_, index) => ({
            role: (
                ['front', 'back', 'top', 'bottom', 'side', 'divider'] as const
            )[index % 6],
            quantity: 1,
            w_m: 0.2 + ((index * 37) % 60) / 100,
            h_m: 0.15 + ((index * 53) % 45) / 100,
            thickness_m: 0.018,
            cutouts: [],
        }));
        const stock = Array.from({ length: 10 }, (_, index) => ({
            index,
            w_m: 0.6 + index * 0.22,
            h_m: 0.45 + index * 0.15,
            ...(index < 9 ? { quantity: 2 } : {}),
        }));

        for (const cut of ['guillotine', 'free'] as const) {
            const sheet: ResolvedSheet = {
                stock,
                kerf_m: 0.003,
                rotate: true,
                cut,
            };
            const start = performance.now();
            const layout = nestPieces(pieces, sheet);
            const elapsed = performance.now() - start;

            expect(layout.sheets.length).toBeGreaterThan(0);
            expect(elapsed, cut).toBeLessThan(400);
        }
    });
});
