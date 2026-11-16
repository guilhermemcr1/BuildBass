import type { Plan } from './types';

// Corte total. "Sem desconto do MDF" = as seis faces pelas medidas internas, como se o
// material não tivesse espessura; "com desconto" = as peças reais do plano, em que a espessura já
// foi somada às medidas. A diferença é o que a espessura acrescenta ao corte.
export type Basis = {
    pieces: number;
    area_m2: number;
    // Soma dos perímetros das peças.
    cutLength_m: number;
};

export type CutTotals = {
    gross: Basis;
    net: Basis;
    difference: Basis;
};

type Rect = { quantity: number; w_m: number; h_m: number };

function basisOf(rects: Rect[]): Basis {
    return rects.reduce<Basis>(
        (total, { quantity, w_m, h_m }) => ({
            pieces: total.pieces + quantity,
            area_m2: total.area_m2 + quantity * w_m * h_m,
            cutLength_m: total.cutLength_m + quantity * 2 * (w_m + h_m),
        }),
        { pieces: 0, area_m2: 0, cutLength_m: 0 },
    );
}

export function cutTotals(plan: Plan): CutTotals {
    const { w_m, h_m, d_m } = plan.dimensions.internal;
    const faces: Rect[] = [
        { quantity: 2, w_m, h_m },
        { quantity: 2, w_m, h_m: d_m },
        { quantity: 2, w_m: h_m, h_m: d_m },
        // A divisória da bandpass já é medida pelo interior da câmara.
        ...plan.pieces
            .filter(({ role }) => role === 'divider')
            .map(({ quantity }) => ({ quantity, w_m, h_m })),
    ];
    const gross = basisOf(faces);
    const net = basisOf(plan.pieces);

    return {
        gross,
        net,
        difference: {
            pieces: net.pieces - gross.pieces,
            area_m2: net.area_m2 - gross.area_m2,
            cutLength_m: net.cutLength_m - gross.cutLength_m,
        },
    };
}
