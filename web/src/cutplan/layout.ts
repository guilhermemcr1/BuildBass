import type { CornerId, Cutout, CutoutRef } from './types';

// Posição dos recortes numa peça: fila única ao longo do lado maior,
// centralizada no lado menor, com folgas iguais entre os itens e as bordas.

export type LayoutItem = {
    // Extensão do recorte no eixo horizontal e vertical da peça; ausente = sem medida.
    w_m?: number;
    h_m?: number;
    // Redondo mede a folga como círculo (não como o quadrado que o contém).
    shape?: string;
    // Diâmetro do aro do alto-falante, maior que o recorte: nada pode ficar embaixo dele.
    outer_m?: number;
};

// Recorte posicionado, para medir folgas: centro, extensão e se é redondo.
export type Footprint = {
    x: number;
    y: number;
    w: number;
    h: number;
    round: boolean;
    // Aro (redondo, diâmetro): só não pode cobrir outro recorte nem outro aro.
    outer?: number;
};

const withOuter = (f: Footprint): Footprint =>
    f.outer === undefined ? f : { ...f, w: f.outer, h: f.outer };

// Folga suficiente: `web_m` de madeira entre os furos e nenhum aro por cima de outro recorte.
export function clears(a: Footprint, b: Footprint, web_m: number): boolean {
    return (
        gapBetween(a, b) >= web_m - 1e-9 &&
        gapBetween(withOuter(a), withOuter(b)) >= -1e-9
    );
}

// Madeira entre dois recortes (negativa = se sobrepõem). Redondo conta como círculo: um alto-falante
// ao lado de um duto de canto não briga pelo quadrado vazio em volta do círculo.
export function gapBetween(a: Footprint, b: Footprint): number {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);

    if (a.round && b.round) {
        return Math.hypot(dx, dy) - a.w / 2 - b.w / 2;
    }

    if (a.round || b.round) {
        const [circle, box] = a.round ? [a, b] : [b, a];
        const sx = Math.max(dx - box.w / 2, 0);
        const sy = Math.max(dy - box.h / 2, 0);

        return Math.hypot(sx, sy) - circle.w / 2;
    }

    const sx = dx - (a.w + b.w) / 2;
    const sy = dy - (a.h + b.h) / 2;

    return sx > 0 && sy > 0 ? Math.hypot(sx, sy) : Math.max(sx, sy);
}

const FREE_STEP_M = 0.005;

// Centro livre mais perto de `item` (a partir do centro dele), a `web_m` das bordas e dos
// obstáculos, numa grade de 5 mm. Sem lugar, indefinido.
export function nearestFree(
    panel: { w_m: number; h_m: number },
    item: Footprint,
    obstacles: Footprint[],
    web_m: number,
): Center | undefined {
    const free = (x: number, y: number) =>
        obstacles.every((other) => clears({ ...item, x, y }, other, web_m));

    if (free(item.x, item.y)) {
        return { x_m: item.x, y_m: item.y };
    }

    // O furo fica a `web_m` da borda; o aro, dentro do painel.
    const halfW = Math.max(item.w / 2 + web_m, (item.outer ?? 0) / 2);
    const halfH = Math.max(item.h / 2 + web_m, (item.outer ?? 0) / 2);
    const [minX, maxX] = [halfW, panel.w_m - halfW];
    const [minY, maxY] = [halfH, panel.h_m - halfH];
    let best: { x: number; y: number; d: number } | undefined;

    for (let x = minX; x <= maxX + 1e-9; x += FREE_STEP_M) {
        for (let y = minY; y <= maxY + 1e-9; y += FREE_STEP_M) {
            const d = Math.hypot(x - item.x, y - item.y);

            if ((best === undefined || d < best.d) && free(x, y)) {
                best = { x, y, d };
            }
        }
    }

    const mm = (m: number) => Math.round(m * 1000) / 1000;

    return best === undefined
        ? undefined
        : { x_m: mm(best.x), y_m: mm(best.y) };
}

export type Center = { x_m: number; y_m: number };

export type LayoutResult = {
    // Um centro por item, na ordem recebida; indefinido para item sem medida ou quando não cabe.
    centers: (Center | undefined)[];
    // A soma das extensões passa do lado maior.
    doNotFit: boolean;
    // Sobra menos madeira que a espessura entre recortes ou entre recorte e borda.
    tight: boolean;
    // A extensão no lado menor passa do lado menor.
    tooBig: boolean;
};

const EPSILON = 1e-12;

function sized(item: LayoutItem): item is Required<LayoutItem> {
    return item.w_m !== undefined && item.h_m !== undefined;
}

export type EdgeSide = 'bottom' | 'top' | 'left' | 'right';

export type EdgeOptions = {
    // Borda em que os itens marcados ficam; ausente = a extremidade de baixo/esquerda do lado maior.
    side?: EdgeSide;
    // Posição ao longo da borda: centralizado ou encostado no início/fim (canto).
    align?: 'center' | 'start' | 'end';
};

// Dutos numa borda: como se faz na prática, os dutos ficam juntos numa borda (ou canto), lado a
// lado ao longo dela, e os demais itens (alto-falantes) seguem a fila única centralizada no espaço
// que sobra. Se os dutos não cabem lado a lado, volta à fila única de tudo.
export function layoutEdge(
    panel: { w_m: number; h_m: number },
    items: LayoutItem[],
    atEdge: boolean[],
    web_m: number,
    { side, align = 'center' }: EdgeOptions = {},
): LayoutResult {
    const edgeItems = items
        .filter((_item, index) => atEdge[index])
        .filter(sized);
    const resolved: EdgeSide =
        side ?? (panel.w_m >= panel.h_m ? 'left' : 'bottom');
    // Borda de baixo/de cima: os itens correm na horizontal e a profundidade é vertical.
    const horizontal = resolved === 'bottom' || resolved === 'top';
    const run = horizontal ? panel.w_m : panel.h_m;
    const depth = horizontal ? panel.h_m : panel.w_m;
    const runOf = (item: Required<LayoutItem>) =>
        horizontal ? item.w_m : item.h_m;
    const depthOf = (item: Required<LayoutItem>) =>
        horizontal ? item.h_m : item.w_m;
    const runTotal = edgeItems.reduce((sum, item) => sum + runOf(item), 0);
    const deepest = Math.max(0, ...edgeItems.map(depthOf));
    // O painel tem a medida externa: a folga `web` (a espessura) já deixa o recorte rente à parede
    // interna.
    const wall = web_m;
    const centered = align === 'center';
    const gap = centered ? (run - runTotal) / (edgeItems.length + 1) : web_m;
    const used = centered
        ? run
        : wall + runTotal + web_m * (edgeItems.length - 1);

    if (
        edgeItems.length === 0 ||
        (centered && gap < web_m - EPSILON) ||
        used > run + EPSILON ||
        wall + deepest > depth + EPSILON
    ) {
        return layoutRow(panel, items, web_m);
    }

    const centers: (Center | undefined)[] = items.map(() => undefined);
    // Posição ao longo da borda, a partir do início (esquerda ou baixo).
    let cursor = centered ? gap : align === 'start' ? wall : run - used;
    const fromEdge = wall + deepest / 2;
    const depthPos =
        resolved === 'bottom' || resolved === 'left'
            ? fromEdge
            : depth - fromEdge;

    items.forEach((item, index) => {
        if (!atEdge[index] || !sized(item)) {
            return;
        }

        const middle = cursor + runOf(item) / 2;
        cursor += runOf(item) + gap;
        centers[index] = horizontal
            ? { x_m: middle, y_m: depthPos }
            : { x_m: depthPos, y_m: middle };
    });

    // O resto (alto-falantes) fica centralizado no trecho depois do bloco de dutos.
    const taken = wall + deepest + web_m;
    const offset = resolved === 'bottom' || resolved === 'left' ? taken : 0;
    const restIdx = items.flatMap((_item, index) =>
        atEdge[index] ? [] : [index],
    );
    const rest = layoutRow(
        horizontal
            ? { w_m: run, h_m: depth - taken }
            : { w_m: depth - taken, h_m: run },
        restIdx.map((index) => items[index]!),
        web_m,
    );

    restIdx.forEach((index, k) => {
        const c = rest.centers[k];
        const item = items[index]!;

        if (c !== undefined && sized(item)) {
            // Quando o trecho que sobra é menor que o recorte, o centro dele levaria o furo para fora
            // da peça: o recorte é trazido de volta para dentro do painel (o aviso continua).
            centers[index] = insidePanel(
                panel,
                item,
                horizontal
                    ? { x_m: c.x_m, y_m: c.y_m + offset }
                    : { x_m: c.x_m + offset, y_m: c.y_m },
                web_m,
            );
        }
    });

    // Num canto, os dutos ocupam só o canto, não a borda inteira: se o alto-falante não cabe na
    // faixa que sobra, procura o lugar livre mais perto do centro do painel, desviando dos dutos.
    const covered = restIdx.some((index) => {
        const item = items[index]!;
        const center = centers[index];

        return (
            sized(item) &&
            center !== undefined &&
            items.some((other, k) => {
                const at = centers[k];

                return (
                    atEdge[k] &&
                    sized(other) &&
                    at !== undefined &&
                    !clears(
                        footprintOf(item, center),
                        footprintOf(other, at),
                        web_m,
                    )
                );
            })
        );
    });

    if (!centered && (rest.tooBig || rest.doNotFit || rest.tight || covered)) {
        const beside = besideCorner(panel, items, atEdge, centers, web_m);

        if (beside !== undefined) {
            return {
                centers: beside,
                doNotFit: false,
                tight: false,
                tooBig: false,
            };
        }
    }

    return {
        centers,
        doNotFit: rest.doNotFit,
        tight: rest.tight,
        tooBig: rest.tooBig,
    };
}

function footprintOf(item: Required<LayoutItem>, center: Center): Footprint {
    return {
        x: center.x_m,
        y: center.y_m,
        w: item.w_m,
        h: item.h_m,
        round: item.shape === 'round',
        ...(item.outer_m === undefined ? {} : { outer: item.outer_m }),
    };
}

// Os demais itens no painel inteiro (fila centralizada), cada um levado ao lugar livre mais perto
// dali sem encostar nos dutos do canto nem nos já colocados. Algum sem lugar: indefinido.
function besideCorner(
    panel: { w_m: number; h_m: number },
    items: LayoutItem[],
    atEdge: boolean[],
    edgeCenters: (Center | undefined)[],
    web_m: number,
): (Center | undefined)[] | undefined {
    const obstacles: Footprint[] = [];

    items.forEach((item, index) => {
        const center = edgeCenters[index];

        if (atEdge[index] && sized(item) && center !== undefined) {
            obstacles.push(footprintOf(item, center));
        }
    });

    const restIdx = items.flatMap((item, index) =>
        atEdge[index] || !sized(item) ? [] : [index],
    );
    const row = layoutRow(
        panel,
        restIdx.map((index) => items[index]!),
        web_m,
    );
    const centers = [...edgeCenters];

    for (const [k, index] of restIdx.entries()) {
        const item = items[index] as Required<LayoutItem>;
        const start = row.centers[k] ?? {
            x_m: panel.w_m / 2,
            y_m: panel.h_m / 2,
        };
        const spot = nearestFree(
            panel,
            footprintOf(item, start),
            obstacles,
            web_m,
        );

        if (spot === undefined) {
            return undefined;
        }

        centers[index] = spot;
        obstacles.push(footprintOf(item, spot));
    }

    return centers;
}

// Centro que mantém o recorte dentro do painel, a uma espessura da borda quando cabe; maior que o
// painel, fica centralizado.
function insidePanel(
    panel: { w_m: number; h_m: number },
    item: Required<LayoutItem>,
    center: Center,
    web_m: number,
): Center {
    const fit = (value: number, extent: number, size: number) => {
        const half = extent / 2;
        const margin = Math.min(web_m, Math.max(0, (size - extent) / 2));
        const low = half + margin;
        const high = size - half - margin;

        return low > high ? size / 2 : Math.min(Math.max(value, low), high);
    };

    return {
        x_m: fit(center.x_m, item.w_m, panel.w_m),
        y_m: fit(center.y_m, item.h_m, panel.h_m),
    };
}

export function layoutRow(
    panel: { w_m: number; h_m: number },
    items: LayoutItem[],
    web_m: number,
): LayoutResult {
    const known = items.filter(sized);
    const centers: (Center | undefined)[] = items.map(() => undefined);

    if (known.length === 0) {
        return { centers, doNotFit: false, tight: false, tooBig: false };
    }

    // A fila corre no lado maior; empate corre na horizontal.
    const alongX = panel.w_m >= panel.h_m;
    const length = alongX ? panel.w_m : panel.h_m;
    const across = alongX ? panel.h_m : panel.w_m;
    const along = (item: Required<LayoutItem>) =>
        alongX ? item.w_m : item.h_m;
    const cross = (item: Required<LayoutItem>) =>
        alongX ? item.h_m : item.w_m;

    const total = known.reduce((sum, item) => sum + along(item), 0);
    const gap = (length - total) / (known.length + 1);
    const widest = Math.max(...known.map(cross));
    const edge = (across - widest) / 2;
    const doNotFit = total > length + EPSILON;
    const tooBig = widest > across + EPSILON;
    const tight = gap < web_m - EPSILON || edge < web_m - EPSILON;

    if (!doNotFit) {
        let cursor = gap;

        items.forEach((item, index) => {
            if (!sized(item)) {
                return;
            }

            const extent = along(item);
            const position = cursor + extent / 2;
            cursor += extent + gap;
            centers[index] = alongX
                ? { x_m: position, y_m: across / 2 }
                : { x_m: across / 2, y_m: position };
        });
    }

    return { centers, doNotFit, tight, tooBig };
}

export type CutoutIssue = {
    ref: CutoutRef;
    id: 'cutoutOverlap' | 'cutoutInGlueBand' | 'cutoutOutside';
};

type Box = {
    ref: CutoutRef;
    manual: boolean;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};

// Largura e altura do retângulo que envolve o recorte no painel, já com o giro do triangular.
export function cutoutExtent(cutout: Cutout): { w?: number; h?: number } {
    switch (cutout.shape) {
        case 'round':
            return { w: cutout.diameter_m, h: cutout.diameter_m };
        case 'rect':
            return { w: cutout.width_m, h: cutout.height_m };
        case 'triangle': {
            const turned =
                cutout.rotation_deg === 90 || cutout.rotation_deg === 270;

            return turned
                ? { w: cutout.height_m, h: cutout.base_m }
                : { w: cutout.base_m, h: cutout.height_m };
        }
    }
}

// Vértices do triangular em coordenadas da peça (y para cima). Sem giro, a base fica embaixo e a
// ponta em cima; o giro é anti-horário. Com `corner`, é o triângulo retângulo com o ângulo reto
// naquele canto do retângulo base × altura (o giro não se aplica).
export function trianglePoints(
    cx: number,
    cy: number,
    base: number,
    height: number,
    rotation: Cutout['rotation_deg'] | 0 = 0,
    corner?: CornerId,
): [number, number][] {
    const [hb, hh] = [base / 2, height / 2];

    if (corner !== undefined) {
        const right: Record<CornerId, [number, number][]> = {
            bottomLeft: [
                [-hb, -hh],
                [hb, -hh],
                [-hb, hh],
            ],
            bottomRight: [
                [-hb, -hh],
                [hb, -hh],
                [hb, hh],
            ],
            topLeft: [
                [-hb, -hh],
                [-hb, hh],
                [hb, hh],
            ],
            topRight: [
                [hb, -hh],
                [hb, hh],
                [-hb, hh],
            ],
        };

        return right[corner].map(([x, y]) => [cx + x, cy + y]);
    }

    const upright: [number, number][] = [
        [-hb, -hh],
        [hb, -hh],
        [0, hh],
    ];
    const turns = (rotation ?? 0) / 90;

    return upright.map(([x, y]) => {
        let [px, py] = [x, y];

        for (let k = 0; k < turns; k++) {
            [px, py] = [-py, px];
        }

        return [cx + px, cy + py];
    });
}

// O mesmo triângulo como `points` de SVG, com centro em (cx, cy) no desenho (y para baixo).
export function svgTriangle(
    cx: number,
    cy: number,
    base: number,
    height: number,
    rotation: Cutout['rotation_deg'] | 0 = 0,
    corner?: CornerId,
): string {
    return trianglePoints(0, 0, base, height, rotation, corner)
        .map(([x, y]) => `${cx + x},${cy - y}`)
        .join(' ');
}

// Retângulo que envolve o recorte (inclusive o triangular); sem medida ou sem centro, nada.
function boxOf(cutout: Cutout): Box | undefined {
    const { w, h } = cutoutExtent(cutout);

    if (
        cutout.ref === undefined ||
        cutout.center === undefined ||
        w === undefined ||
        h === undefined
    ) {
        return undefined;
    }

    const { x_m, y_m } = cutout.center;

    return {
        ref: cutout.ref,
        manual: cutout.manual === true,
        x0: x_m - w / 2,
        y0: y_m - h / 2,
        x1: x_m + w / 2,
        y1: y_m + h / 2,
    };
}

// Posição manual dos recortes. Só olha o que envolve um recorte manual: a
// fila automática já tem os avisos dela (`layoutRow`). Fora da peça vence a faixa de colagem; dois
// recortes que se tocam ou ficam a menos de `web_m` geram um aviso para cada um.
export function checkCutouts(
    panel: { w_m: number; h_m: number },
    cutouts: Cutout[],
    web_m: number,
): CutoutIssue[] {
    const boxes = cutouts.flatMap((cutout) => {
        const box = boxOf(cutout);

        return box === undefined ? [] : [box];
    });
    const issues: CutoutIssue[] = [];
    const overlapping = new Set<Box>();

    boxes.forEach((a, index) => {
        for (const b of boxes.slice(index + 1)) {
            if (!a.manual && !b.manual) {
                continue;
            }

            const gap = Math.max(
                a.x0 - b.x1,
                b.x0 - a.x1,
                a.y0 - b.y1,
                b.y0 - a.y1,
            );

            if (gap < web_m - EPSILON) {
                overlapping.add(a);
                overlapping.add(b);
            }
        }
    });

    for (const box of boxes) {
        if (overlapping.has(box)) {
            issues.push({ ref: box.ref, id: 'cutoutOverlap' });
        }

        if (!box.manual) {
            continue;
        }

        const edge = Math.min(
            box.x0,
            box.y0,
            panel.w_m - box.x1,
            panel.h_m - box.y1,
        );

        if (edge < -EPSILON) {
            issues.push({ ref: box.ref, id: 'cutoutOutside' });
        } else if (edge < web_m - EPSILON) {
            issues.push({ ref: box.ref, id: 'cutoutInGlueBand' });
        }
    }

    return issues;
}
