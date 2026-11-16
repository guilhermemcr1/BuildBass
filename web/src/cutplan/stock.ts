import type { ResolvedStockItem, SheetConfig, StockItem } from './types';

// Estoque de chapas: a raiz de `SheetConfig` é o 1º item e `more` guarda
// os demais. Estas funções são a única ponte entre as duas formas.

export const MAX_STOCK_ITEMS = 10;

// Itens na ordem da lista, rascunhos incluídos (o que a interface mostra). Sem chapa, lista vazia.
export function stockItems(sheet?: SheetConfig): StockItem[] {
    if (sheet === undefined) {
        return [];
    }

    const first: StockItem = {};

    if (sheet.w_m !== undefined) {
        first.w_m = sheet.w_m;
    }

    if (sheet.h_m !== undefined) {
        first.h_m = sheet.h_m;
    }

    if (sheet.quantity !== undefined) {
        first.quantity = sheet.quantity;
    }

    return [first, ...(sheet.more ?? []).map((item) => ({ ...item }))];
}

// Só os itens completos, com a posição de cada um na lista inteira.
export function stockOf(sheet?: SheetConfig): ResolvedStockItem[] {
    return stockItems(sheet).flatMap((item, index) =>
        item.w_m === undefined || item.h_m === undefined
            ? []
            : [
                  {
                      index,
                      w_m: item.w_m,
                      h_m: item.h_m,
                      ...(item.quantity === undefined
                          ? {}
                          : { quantity: item.quantity }),
                  },
              ],
    );
}

// Grava a lista de volta. Lista vazia apaga a chapa inteira (perda de serra, rotação e tipo de corte
// sem chapa não significam nada), como já acontecia ao esvaziar a chapa única.
export function withStock(
    sheet: SheetConfig | undefined,
    items: StockItem[],
): SheetConfig | undefined {
    if (items.length === 0) {
        return undefined;
    }

    const [first, ...rest] = items.slice(0, MAX_STOCK_ITEMS);
    const next: SheetConfig = {};

    if (first.w_m !== undefined) {
        next.w_m = first.w_m;
    }

    if (first.h_m !== undefined) {
        next.h_m = first.h_m;
    }

    if (sheet?.kerf_m !== undefined) {
        next.kerf_m = sheet.kerf_m;
    }

    if (sheet?.rotate !== undefined) {
        next.rotate = sheet.rotate;
    }

    if (first.quantity !== undefined) {
        next.quantity = first.quantity;
    }

    if (rest.length > 0) {
        next.more = rest.map((item) => ({ ...item }));
    }

    if (sheet?.cut !== undefined) {
        next.cut = sheet.cut;
    }

    return next;
}
