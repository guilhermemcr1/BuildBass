import { maxRectsBin } from './maxrects';
import type { FreeChoice, PackItem } from './maxrects';
import type {
    CutMode,
    Piece,
    PieceRef,
    Placement,
    ResolvedSheet,
    ResolvedStockItem,
} from './types';

// Encaixe das peças no estoque de chapas do usuário.
//
// Dois tipos de corte:
// - Serra (guilhotina): todo corte atravessa o retângulo livre de lado a lado, como numa serra de
//   bancada. Testa combinações de escolha do livre (Best Short Side Fit, Best Long Side Fit, Best
//   Area Fit) e de divisão do que sobra (Shorter/Longer Leftover Axis, Max Area);
// - CNC/tupia (livre): MaxRects (maxrects.ts), e fica com o melhor entre ele e a guilhotina, já que
//   uma disposição de guilhotina também serve para corte livre.
//
// Fontes, citadas de memória e A CONFERIR antes de tratar como definitivas:
// - Jylänki, J. (2010). "A Thousand Ways to Pack the Bin — A Practical Approach to
//   Two-Dimensional Rectangle Bin Packing" (guilhotina, MaxRects e as heurísticas acima);
// - Coffman, E. G.; Garey, M. R.; Johnson, D. S. (1980). "Performance bounds for level-oriented
//   two-dimensional packing algorithms" (empacotamento 2D por níveis/prateleiras).
//
// São heurísticas: não garantem o mínimo de chapas, mas são deterministas e rápidas. A primeira
// tentativa é exatamente a da 008, e outra só a substitui se for estritamente melhor; por isso um
// projeto antigo só muda de encaixe quando economiza chapa.

export type { PieceRef, Placement } from './types';

export type Sheet = {
    // Posição, na lista do estoque, do item de onde veio a chapa.
    stock: number;
    w_m: number;
    h_m: number;
    placements: Placement[];
    used_m2: number;
    utilization: number;
};

export type SheetLayout = {
    sheets: Sheet[];
    // Não cabem em nenhum item do estoque, em nenhuma orientação permitida.
    oversize: PieceRef[];
    // Caberiam, mas a quantidade dos itens onde cabem acabou.
    unplaced: PieceRef[];
    sheetCount: number;
    opened_m2: number;
    // Área das peças ÷ área das chapas abertas.
    utilization: number;
    waste_m2: number;
    cut: CutMode;
    // Chapas usadas de cada item, na ordem da lista.
    byStock: { stock: number; count: number }[];
};

type Item = PackItem;

type Order = (a: Item, b: Item) => number;

const byRole = (a: Item, b: Item) =>
    a.role === b.role ? a.unit - b.unit : a.role < b.role ? -1 : 1;

const area = (item: Item) => item.w_m * item.h_m;
const long = (item: Item) => Math.max(item.w_m, item.h_m);

// Maior área primeiro; empates pelo lado maior e depois por nome, para o resultado não variar.
const BY_AREA: Order = (a, b) =>
    area(b) - area(a) || long(b) - long(a) || byRole(a, b);

const BY_LONG_SIDE: Order = (a, b) =>
    long(b) - long(a) || area(b) - area(a) || byRole(a, b);

const BY_PERIMETER: Order = (a, b) =>
    b.w_m + b.h_m - (a.w_m + a.h_m) || area(b) - area(a) || byRole(a, b);

const BY_WIDTH: Order = (a, b) =>
    b.w_m - a.w_m || b.h_m - a.h_m || byRole(a, b);

const BY_HEIGHT: Order = (a, b) =>
    b.h_m - a.h_m || b.w_m - a.w_m || byRole(a, b);

const ORDERS = [BY_AREA, BY_LONG_SIDE, BY_PERIMETER, BY_WIDTH, BY_HEIGHT];

// Tolerância contra o erro de ponto flutuante nas somas de medidas.
const EPS = 1e-9;

// ---------------------------------------------------------------------------------------------
// Guilhotina

type GuillotineChoice = 'bssf' | 'blsf' | 'baf';
type GuillotineSplit = 'sla' | 'lla' | 'maxArea';

type Free = { x: number; y: number; w: number; h: number };

type Candidate = {
    free: number;
    rotated: boolean;
    score: number;
    tie: number;
};

function better(a: Candidate, b: Candidate | undefined): boolean {
    return (
        b === undefined ||
        a.score < b.score - EPS ||
        (Math.abs(a.score - b.score) <= EPS && a.tie < b.tie - EPS)
    );
}

function fitScore(
    choice: GuillotineChoice,
    free: Free,
    w: number,
    h: number,
): [number, number] {
    const leftW = free.w - w;
    const leftH = free.h - h;
    const short = Math.min(leftW, leftH);
    const longer = Math.max(leftW, leftH);

    switch (choice) {
        case 'bssf':
            return [short, longer];
        case 'blsf':
            return [longer, short];
        case 'baf':
            return [free.w * free.h - w * h, short];
    }
}

// Divide o retângulo livre depois de colocar a peça no canto inferior esquerdo. "Horizontal" é o
// corte que atravessa toda a largura do livre, deixando uma faixa em cima e um resto à direita.
function split(
    rule: GuillotineSplit,
    free: Free,
    w: number,
    h: number,
): Free[] {
    const leftoverW = free.w - w;
    const leftoverH = free.h - h;
    const horizontal =
        rule === 'sla'
            ? leftoverW <= leftoverH
            : rule === 'lla'
              ? leftoverW > leftoverH
              : Math.max(free.w * leftoverH, leftoverW * h) >=
                Math.max(w * leftoverH, leftoverW * free.h);
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

type Bin = { placements: Placement[]; place: (item: Item) => boolean };

function guillotineBin(
    width: number,
    height: number,
    kerf: number,
    rotate: boolean,
    choice: GuillotineChoice,
    rule: GuillotineSplit,
): Bin {
    // A chapa ganha uma perda de serra a mais: a última peça não precisa dela.
    const frees: Free[] = [{ x: 0, y: 0, w: width + kerf, h: height + kerf }];
    const placements: Placement[] = [];

    const place = (item: Item): boolean => {
        let best: Candidate | undefined;

        for (const [index, free] of frees.entries()) {
            for (const turned of rotate ? [false, true] : [false]) {
                const w = (turned ? item.h_m : item.w_m) + kerf;
                const h = (turned ? item.w_m : item.h_m) + kerf;

                if (w > free.w + EPS || h > free.h + EPS) {
                    continue;
                }

                const [score, tie] = fitScore(choice, free, w, h);
                const candidate: Candidate = {
                    free: index,
                    rotated: turned,
                    score,
                    tie,
                };

                if (better(candidate, best)) {
                    best = candidate;
                }
            }
        }

        if (best === undefined) {
            return false;
        }

        const free = frees[best.free];
        const w_m = best.rotated ? item.h_m : item.w_m;
        const h_m = best.rotated ? item.w_m : item.h_m;

        placements.push({
            role: item.role,
            unit: item.unit,
            x_m: free.x,
            y_m: free.y,
            w_m,
            h_m,
            rotated: best.rotated,
        });
        frees.splice(
            best.free,
            1,
            ...split(rule, free, w_m + kerf, h_m + kerf),
        );

        return true;
    };

    return { placements, place };
}

// ---------------------------------------------------------------------------------------------
// Várias chapas

type BinFactory = (stock: ResolvedStockItem) => Bin;

// Qual item abrir quando a peça não cabe nas chapas abertas.
type Opener = 'smallest' | 'largest' | 'list';

type Attempt = {
    bins: { stock: ResolvedStockItem; bin: Bin; items: Item[] }[];
    oversize: PieceRef[];
    unplaced: PieceRef[];
};

function fitsEmpty(
    item: Item,
    stock: ResolvedStockItem,
    rotate: boolean,
): boolean {
    const straight = item.w_m <= stock.w_m + EPS && item.h_m <= stock.h_m + EPS;
    const turned =
        rotate && item.h_m <= stock.w_m + EPS && item.w_m <= stock.h_m + EPS;

    return straight || turned;
}

const stockArea = (stock: ResolvedStockItem) => stock.w_m * stock.h_m;

function openOrder(stock: ResolvedStockItem[], opener: Opener) {
    const list = [...stock];

    if (opener === 'smallest') {
        return list.sort(
            (a, b) => stockArea(a) - stockArea(b) || a.index - b.index,
        );
    }

    if (opener === 'largest') {
        return list.sort(
            (a, b) => stockArea(b) - stockArea(a) || a.index - b.index,
        );
    }

    return list;
}

function packStock(
    items: Item[],
    sheet: ResolvedSheet,
    factory: BinFactory,
    opener: Opener,
): Attempt {
    const left = new Map(
        sheet.stock.map((stock) => [stock.index, stock.quantity ?? Infinity]),
    );
    const candidates = openOrder(sheet.stock, opener);
    const attempt: Attempt = { bins: [], oversize: [], unplaced: [] };

    for (const item of items) {
        const open = attempt.bins.find(({ bin }) => bin.place(item));

        if (open !== undefined) {
            open.items.push(item);
            continue;
        }

        const ref = { role: item.role, unit: item.unit };
        const fitting = candidates.filter((stock) =>
            fitsEmpty(item, stock, sheet.rotate),
        );

        if (fitting.length === 0) {
            attempt.oversize.push(ref);
            continue;
        }

        const stock = fitting.find(
            (option) => (left.get(option.index) ?? 0) > 0,
        );

        if (stock === undefined) {
            attempt.unplaced.push(ref);
            continue;
        }

        const bin = factory(stock);

        if (!bin.place(item)) {
            attempt.oversize.push(ref);
            continue;
        }

        left.set(stock.index, (left.get(stock.index) ?? 0) - 1);
        attempt.bins.push({ stock, bin, items: [item] });
    }

    shrink(attempt, sheet, factory, left);

    return attempt;
}

// Cada chapa aberta tenta passar para o menor item ainda disponível onde todas as suas peças cabem:
// é o que faz uma sobra receber as peças pequenas da última chapa inteira.
function shrink(
    attempt: Attempt,
    sheet: ResolvedSheet,
    factory: BinFactory,
    left: Map<number, number>,
) {
    const smaller = [...sheet.stock].sort(
        (a, b) => stockArea(a) - stockArea(b) || a.index - b.index,
    );

    for (const [position, opened] of attempt.bins.entries()) {
        for (const stock of smaller) {
            if (stockArea(stock) >= stockArea(opened.stock) - EPS) {
                break;
            }

            if ((left.get(stock.index) ?? 0) <= 0) {
                continue;
            }

            const bin = factory(stock);

            if (opened.items.every((item) => bin.place(item))) {
                left.set(stock.index, (left.get(stock.index) ?? 0) - 1);
                left.set(
                    opened.stock.index,
                    (left.get(opened.stock.index) ?? 0) + 1,
                );
                attempt.bins[position] = { stock, bin, items: opened.items };
                break;
            }
        }
    }
}

const openedArea = (attempt: Attempt) =>
    attempt.bins.reduce((sum, { stock }) => sum + stockArea(stock), 0);

const missing = (attempt: Attempt) =>
    attempt.oversize.length + attempt.unplaced.length;

// FR-003: menos peças sem chapa, depois menos área aberta, depois menos chapas.
function strictlyBetter(next: Attempt, current: Attempt): boolean {
    if (missing(next) !== missing(current)) {
        return missing(next) < missing(current);
    }

    const nextArea = openedArea(next);
    const currentArea = openedArea(current);

    if (Math.abs(nextArea - currentArea) > EPS) {
        return nextArea < currentArea;
    }

    return next.bins.length < current.bins.length;
}

function layoutOf(attempt: Attempt, cut: CutMode): SheetLayout {
    const sheets = attempt.bins.map(({ stock, bin }): Sheet => {
        const used = bin.placements.reduce((sum, p) => sum + p.w_m * p.h_m, 0);
        const sheetArea = stockArea(stock);

        return {
            stock: stock.index,
            w_m: stock.w_m,
            h_m: stock.h_m,
            placements: bin.placements,
            used_m2: used,
            utilization: sheetArea === 0 ? 0 : used / sheetArea,
        };
    });
    const used = sheets.reduce((sum, { used_m2 }) => sum + used_m2, 0);
    const opened = openedArea(attempt);
    const counts = new Map<number, number>();

    for (const { stock } of sheets) {
        counts.set(stock, (counts.get(stock) ?? 0) + 1);
    }

    return {
        sheets,
        oversize: attempt.oversize,
        unplaced: attempt.unplaced,
        sheetCount: sheets.length,
        opened_m2: opened,
        utilization: opened === 0 ? 0 : used / opened,
        waste_m2: opened - used,
        cut,
        byStock: [...counts.entries()]
            .sort(([a], [b]) => a - b)
            .map(([stock, count]) => ({ stock, count })),
    };
}

// ---------------------------------------------------------------------------------------------
// Grade de tentativas

type Strategy = {
    rotate: boolean;
    order: Order;
    factory: (sheet: ResolvedSheet, rotate: boolean) => BinFactory;
};

const guillotine =
    (choice: GuillotineChoice, rule: GuillotineSplit) =>
    (sheet: ResolvedSheet, rotate: boolean): BinFactory =>
    (stock) =>
        guillotineBin(stock.w_m, stock.h_m, sheet.kerf_m, rotate, choice, rule);

const maxRects =
    (choice: FreeChoice) =>
    (sheet: ResolvedSheet, rotate: boolean): BinFactory =>
    (stock) =>
        maxRectsBin(stock.w_m, stock.h_m, sheet.kerf_m, rotate, choice);

function strategies(
    rotations: boolean[],
    factories: Strategy['factory'][],
): Strategy[] {
    return rotations.flatMap((rotate) =>
        ORDERS.flatMap((order) =>
            factories.map((factory) => ({ rotate, order, factory })),
        ),
    );
}

const GUILLOTINE_FACTORIES = (['bssf', 'blsf', 'baf'] as const).flatMap(
    (choice) =>
        (['sla', 'lla', 'maxArea'] as const).map((rule) =>
            guillotine(choice, rule),
        ),
);

const MAXRECTS_FACTORIES = (['bssf', 'baf', 'bl'] as const).map((choice) =>
    maxRects(choice),
);

// As quatro tentativas da 008, na mesma ordem: sem girar e girando, por área e pelo lado maior.
function legacy(rotations: boolean[]): Strategy[] {
    return rotations.flatMap((rotate) =>
        [BY_AREA, BY_LONG_SIDE].map((order) => ({
            rotate,
            order,
            factory: guillotine('bssf', 'sla'),
        })),
    );
}

// Sugere como cortar as peças do estoque do usuário.
export function nestPieces(pieces: Piece[], sheet: ResolvedSheet): SheetLayout {
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
    const rotations = [false, ...(sheet.rotate ? [true] : [])];
    // Com um item só, as três formas de abrir chapa dão o mesmo resultado.
    const openers: Opener[] =
        sheet.stock.length > 1 ? ['smallest', 'largest', 'list'] : ['list'];
    const grid = [
        ...legacy(rotations),
        ...strategies(rotations, GUILLOTINE_FACTORIES),
        ...(sheet.cut === 'free'
            ? strategies(rotations, MAXRECTS_FACTORIES)
            : []),
    ];
    let best: Attempt | undefined;

    for (const strategy of grid) {
        const sorted = [...items].sort(strategy.order);
        const factory = strategy.factory(sheet, strategy.rotate);

        for (const opener of openers) {
            const attempt = packStock(sorted, sheet, factory, opener);

            if (best === undefined || strictlyBetter(attempt, best)) {
                best = attempt;
            }
        }
    }

    return layoutOf(
        best ?? { bins: [], oversize: [], unplaced: [] },
        sheet.cut,
    );
}
