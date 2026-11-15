// Cópia fiel do encaixe da feature 008 (git b99f2f7), só para os testes da 012 compararem o
// algoritmo novo com o antigo (FR-008, SC-001). Não é usada pelo app.
import type { Piece, PieceRole } from '../types';

type ResolvedSheet = {
    w_m: number;
    h_m: number;
    kerf_m: number;
    rotate: boolean;
};

// Encaixe das peças numa chapa que o usuário tem (specs/008, contracts/cutplan-sheet.md).
//
// Algoritmo: corte de guilhotina (todo corte atravessa o retângulo livre de lado a lado, como numa
// serra de bancada) com *Best Short Side Fit* para escolher onde colocar cada peça e *Shorter
// Leftover Axis* para decidir o sentido da divisão que sobra. Fontes, citadas de memória e A
// CONFERIR antes de tratar como definitivas:
// - Jylänki, J. (2010). "A Thousand Ways to Pack the Bin — A Practical Approach to
//   Two-Dimensional Rectangle Bin Packing" (heurísticas BSSF e SLA para guilhotina);
// - Coffman, E. G.; Garey, M. R.; Johnson, D. S. (1980). "Performance bounds for level-oriented
//   two-dimensional packing algorithms" (empacotamento 2D por níveis/prateleiras).
// É uma heurística: não garante o menor número de chapas possível, mas é determinista e rápida.

export type PieceRef = { role: PieceRole; unit: number };

export type Placement = PieceRef & {
    // Canto inferior esquerdo da peça na chapa.
    x_m: number;
    y_m: number;
    // Medidas como colocadas (trocadas quando girada).
    w_m: number;
    h_m: number;
    rotated: boolean;
};

export type Sheet = {
    placements: Placement[];
    used_m2: number;
    utilization: number;
};

export type SheetLayout = {
    sheets: Sheet[];
    // Peças que não cabem em nenhuma orientação permitida.
    oversize: PieceRef[];
    sheetCount: number;
    utilization: number;
    waste_m2: number;
};

type Free = { x: number; y: number; w: number; h: number };

type Item = PieceRef & { w_m: number; h_m: number };

type Order = (a: Item, b: Item) => number;

const byRole = (a: Item, b: Item) =>
    a.role === b.role ? a.unit - b.unit : a.role < b.role ? -1 : 1;

// Maior área primeiro; empates pelo lado maior e depois por nome, para o resultado não variar.
const BY_AREA: Order = (a, b) =>
    b.w_m * b.h_m - a.w_m * a.h_m ||
    Math.max(b.w_m, b.h_m) - Math.max(a.w_m, a.h_m) ||
    byRole(a, b);

const BY_LONG_SIDE: Order = (a, b) =>
    Math.max(b.w_m, b.h_m) - Math.max(a.w_m, a.h_m) ||
    b.w_m * b.h_m - a.w_m * a.h_m ||
    byRole(a, b);

// Tolerância contra o erro de ponto flutuante nas somas de medidas.
const EPS = 1e-9;

type Candidate = {
    free: number;
    rotated: boolean;
    score: number;
    long: number;
};

function better(a: Candidate, b: Candidate | undefined): boolean {
    return (
        b === undefined ||
        a.score < b.score - EPS ||
        (Math.abs(a.score - b.score) <= EPS && a.long < b.long - EPS)
    );
}

// Divide o retângulo livre depois de colocar a peça no canto inferior esquerdo (SLA).
function split(free: Free, w: number, h: number): Free[] {
    const leftoverW = free.w - w;
    const leftoverH = free.h - h;
    const horizontal = leftoverW <= leftoverH;
    const top: Free = {
        x: free.x,
        y: free.y + h,
        w: horizontal ? free.w : w,
        h: leftoverH,
    };
    const right: Free = {
        x: free.x + w,
        y: free.y,
        w: leftoverW,
        h: horizontal ? h : free.h,
    };

    return [top, right].filter((rect) => rect.w > EPS && rect.h > EPS);
}

type Bin = { free: Free[]; placements: Placement[] };

function pack(items: Item[], sheet: ResolvedSheet, rotate: boolean) {
    const { kerf_m: kerf } = sheet;
    // A chapa ganha uma perda de serra a mais: a última peça não precisa dela.
    const area: Free = { x: 0, y: 0, w: sheet.w_m + kerf, h: sheet.h_m + kerf };
    const bins: Bin[] = [];
    const oversize: PieceRef[] = [];

    const place = (bin: Bin, item: Item): boolean => {
        let best: Candidate | undefined;

        for (const [index, free] of bin.free.entries()) {
            for (const turned of rotate ? [false, true] : [false]) {
                const w = (turned ? item.h_m : item.w_m) + kerf;
                const h = (turned ? item.w_m : item.h_m) + kerf;

                if (w > free.w + EPS || h > free.h + EPS) {
                    continue;
                }

                const candidate: Candidate = {
                    free: index,
                    rotated: turned,
                    score: Math.min(free.w - w, free.h - h),
                    long: Math.max(free.w - w, free.h - h),
                };

                if (better(candidate, best)) {
                    best = candidate;
                }
            }
        }

        if (best === undefined) {
            return false;
        }

        const free = bin.free[best.free];
        const w_m = best.rotated ? item.h_m : item.w_m;
        const h_m = best.rotated ? item.w_m : item.h_m;

        bin.placements.push({
            role: item.role,
            unit: item.unit,
            x_m: free.x,
            y_m: free.y,
            w_m,
            h_m,
            rotated: best.rotated,
        });
        bin.free.splice(best.free, 1, ...split(free, w_m + kerf, h_m + kerf));

        return true;
    };

    for (const item of items) {
        if (bins.some((bin) => place(bin, item))) {
            continue;
        }

        const fresh: Bin = { free: [{ ...area }], placements: [] };

        if (place(fresh, item)) {
            bins.push(fresh);
        } else {
            oversize.push({ role: item.role, unit: item.unit });
        }
    }

    return { bins, oversize };
}

function layoutOf(
    bins: Bin[],
    oversize: PieceRef[],
    sheet: ResolvedSheet,
): SheetLayout {
    const sheetArea = sheet.w_m * sheet.h_m;
    const sheets = bins.map(({ placements }): Sheet => {
        const used = placements.reduce((sum, p) => sum + p.w_m * p.h_m, 0);

        return {
            placements,
            used_m2: used,
            utilization: sheetArea === 0 ? 0 : used / sheetArea,
        };
    });
    const used = sheets.reduce((sum, { used_m2 }) => sum + used_m2, 0);
    const available = sheets.length * sheetArea;

    return {
        sheets,
        oversize,
        sheetCount: sheets.length,
        utilization: available === 0 ? 0 : used / available,
        waste_m2: available - used,
    };
}

// Sugere como cortar as peças da chapa do usuário. Roda duas ordenações (por área e pelo lado
// maior), sem girar e, se permitido, girando; fica com a que deixa menos peças de fora e depois
// usa menos chapas. Empatando, vence a primeira, então girar só muda o resultado quando ajuda.
export function nestPieces008(
    pieces: Piece[],
    sheet: ResolvedSheet,
): SheetLayout {
    const items: Item[] = pieces.flatMap((piece) =>
        Array.from(
            { length: Math.max(0, Math.round(piece.quantity)) },
            (_, index): Item => ({
                role: piece.role,
                unit: index + 1,
                w_m: piece.w_m,
                h_m: piece.h_m,
            }),
        ),
    );
    const attempts = [false, ...(sheet.rotate ? [true] : [])].flatMap(
        (rotate) =>
            [BY_AREA, BY_LONG_SIDE].map((order) =>
                pack([...items].sort(order), sheet, rotate),
            ),
    );
    const best = attempts.reduce((current, next) =>
        next.oversize.length < current.oversize.length ||
        (next.oversize.length === current.oversize.length &&
            next.bins.length < current.bins.length)
            ? next
            : current,
    );

    return layoutOf(best.bins, best.oversize, sheet);
}
