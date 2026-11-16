import type { Cutout, CutoutRef } from './types';

// Posição dos recortes numa peça: fila única ao longo do lado maior,
// centralizada no lado menor, com folgas iguais entre os itens e as bordas.

export type LayoutItem = {
    // Extensão do recorte no eixo horizontal e vertical da peça; ausente = sem medida.
    w_m?: number;
    h_m?: number;
};

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

// Retângulo que envolve o recorte (inclusive o triangular); sem medida ou sem centro, nada.
function boxOf(cutout: Cutout): Box | undefined {
    const w =
        cutout.shape === 'round'
            ? cutout.diameter_m
            : cutout.shape === 'rect'
              ? cutout.width_m
              : cutout.base_m;
    const h = cutout.shape === 'round' ? cutout.diameter_m : cutout.height_m;

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
