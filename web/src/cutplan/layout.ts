// Posição dos recortes numa peça (specs/005, research.md §5): fila única ao longo do lado maior,
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
