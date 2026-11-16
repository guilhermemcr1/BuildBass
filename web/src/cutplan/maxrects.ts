import type { PieceRef, Placement } from './types';

// Encaixe livre MaxRects, para corte em CNC ou tupia: as peças podem ficar
// em posições que não formam cortes de ponta a ponta.
//
// Fonte: Jylänki, J. (2010). "A Thousand Ways to Pack the Bin — A Practical Approach to
// Two-Dimensional Rectangle Bin Packing", §4 (MaxRects; heurísticas Best Short Side Fit, Best Area
// Fit e Bottom-Left). Implementação própria.
//
// A chapa guarda os retângulos livres *maximais*: colocar uma peça corta cada livre que ela cruza em
// até quatro pedaços, e depois saem os livres contidos em outros.

export type FreeChoice = 'bssf' | 'baf' | 'bl';

export type Rect = { x: number; y: number; w: number; h: number };

export type PackItem = PieceRef & { w_m: number; h_m: number };

const EPS = 1e-9;

type Fit = { free: Rect; rotated: boolean; primary: number; secondary: number };

function score(
    choice: FreeChoice,
    free: Rect,
    w: number,
    h: number,
): [number, number] {
    const leftW = free.w - w;
    const leftH = free.h - h;

    switch (choice) {
        case 'bssf':
            return [Math.min(leftW, leftH), Math.max(leftW, leftH)];
        case 'baf':
            return [free.w * free.h - w * h, Math.min(leftW, leftH)];
        case 'bl':
            // y para cima: menor topo e, empatando, mais à esquerda.
            return [free.y + h, free.x];
    }
}

function better(a: Fit, b: Fit | undefined): boolean {
    return (
        b === undefined ||
        a.primary < b.primary - EPS ||
        (Math.abs(a.primary - b.primary) <= EPS &&
            a.secondary < b.secondary - EPS)
    );
}

function overlaps(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.w - EPS &&
        b.x < a.x + a.w - EPS &&
        a.y < b.y + b.h - EPS &&
        b.y < a.y + a.h - EPS
    );
}

function contains(outer: Rect, inner: Rect): boolean {
    return (
        inner.x >= outer.x - EPS &&
        inner.y >= outer.y - EPS &&
        inner.x + inner.w <= outer.x + outer.w + EPS &&
        inner.y + inner.h <= outer.y + outer.h + EPS
    );
}

// Pedaços de `free` que sobram fora de `used` (até quatro, sobrepostos entre si: são maximais).
function splitFree(free: Rect, used: Rect): Rect[] {
    if (!overlaps(free, used)) {
        return [free];
    }

    const pieces: Rect[] = [];

    if (used.x > free.x + EPS) {
        pieces.push({ x: free.x, y: free.y, w: used.x - free.x, h: free.h });
    }

    if (used.x + used.w < free.x + free.w - EPS) {
        pieces.push({
            x: used.x + used.w,
            y: free.y,
            w: free.x + free.w - (used.x + used.w),
            h: free.h,
        });
    }

    if (used.y > free.y + EPS) {
        pieces.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y });
    }

    if (used.y + used.h < free.y + free.h - EPS) {
        pieces.push({
            x: free.x,
            y: used.y + used.h,
            w: free.w,
            h: free.y + free.h - (used.y + used.h),
        });
    }

    return pieces;
}

// Tira os livres contidos em outro; entre dois iguais fica o primeiro, para não variar.
function prune(rects: Rect[]): Rect[] {
    return rects.filter(
        (rect, index) =>
            !rects.some(
                (other, j) =>
                    j !== index &&
                    contains(other, rect) &&
                    (!contains(rect, other) || j < index),
            ),
    );
}

export type MaxRectsBin = {
    placements: Placement[];
    place: (item: PackItem) => boolean;
    // Livres atuais (cópia), para conferência.
    freeRects: () => Rect[];
};

// Uma chapa `w × h`. Cada peça ocupa `(w + kerf) × (h + kerf)`, e a chapa útil é
// `(W + kerf) × (H + kerf)`: a perda de corte separa vizinhas sem sobrar na borda (como na 008).
export function maxRectsBin(
    width: number,
    height: number,
    kerf: number,
    rotate: boolean,
    choice: FreeChoice,
): MaxRectsBin {
    let free: Rect[] = [{ x: 0, y: 0, w: width + kerf, h: height + kerf }];
    const placements: Placement[] = [];

    const place = (item: PackItem): boolean => {
        let best: Fit | undefined;

        for (const rect of free) {
            for (const turned of rotate ? [false, true] : [false]) {
                const w = (turned ? item.h_m : item.w_m) + kerf;
                const h = (turned ? item.w_m : item.h_m) + kerf;

                if (w > rect.w + EPS || h > rect.h + EPS) {
                    continue;
                }

                const [primary, secondary] = score(choice, rect, w, h);
                const fit: Fit = {
                    free: rect,
                    rotated: turned,
                    primary,
                    secondary,
                };

                if (better(fit, best)) {
                    best = fit;
                }
            }
        }

        if (best === undefined) {
            return false;
        }

        const w_m = best.rotated ? item.h_m : item.w_m;
        const h_m = best.rotated ? item.w_m : item.h_m;
        const used: Rect = {
            x: best.free.x,
            y: best.free.y,
            w: w_m + kerf,
            h: h_m + kerf,
        };

        placements.push({
            role: item.role,
            unit: item.unit,
            x_m: used.x,
            y_m: used.y,
            w_m,
            h_m,
            rotated: best.rotated,
        });
        free = prune(
            free
                .flatMap((rect) => splitFree(rect, used))
                .filter((rect) => rect.w > EPS && rect.h > EPS),
        );

        return true;
    };

    return {
        placements,
        place,
        freeRects: () => free.map((rect) => ({ ...rect })),
    };
}
