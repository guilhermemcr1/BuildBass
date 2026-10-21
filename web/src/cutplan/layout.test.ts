import { describe, expect, test } from 'vite-plus/test';
import { layoutRow } from './layout';

const round = (diameter: number) => ({ w_m: diameter, h_m: diameter });

describe('layoutRow', () => {
    test('um item fica centralizado nos dois eixos', () => {
        const result = layoutRow({ w_m: 0.4, h_m: 0.6 }, [round(0.2)], 0.018);

        expect(result.centers[0]?.x_m).toBeCloseTo(0.2, 12);
        expect(result.centers[0]?.y_m).toBeCloseTo(0.3, 12);
        expect(result.doNotFit).toBe(false);
        expect(result.tight).toBe(false);
        expect(result.tooBig).toBe(false);
    });

    test('a fila corre no lado maior do painel (vertical aqui)', () => {
        const result = layoutRow(
            { w_m: 0.4, h_m: 0.6 },
            [round(0.1), round(0.1)],
            0.018,
        );
        const gap = (0.6 - 0.2) / 3;

        expect(result.centers[0]?.x_m).toBeCloseTo(0.2, 12);
        expect(result.centers[1]?.x_m).toBeCloseTo(0.2, 12);
        expect(result.centers[0]?.y_m).toBeCloseTo(gap + 0.05, 12);
        expect(result.centers[1]?.y_m).toBeCloseTo(2 * gap + 0.15, 12);
    });

    test('a fila corre na horizontal quando a largura é o lado maior', () => {
        const result = layoutRow(
            { w_m: 0.6, h_m: 0.4 },
            [round(0.1), round(0.1)],
            0.018,
        );

        expect(result.centers[0]?.y_m).toBeCloseTo(0.2, 12);
        expect(result.centers[0]?.x_m).toBeCloseTo(0.4 / 3 + 0.05, 12);
    });

    test.each([2, 8])('%i itens iguais ficam com folgas iguais', (count) => {
        const size = 0.05;
        const length = 0.9;
        const result = layoutRow(
            { w_m: 0.4, h_m: length },
            Array.from({ length: count }, () => round(size)),
            0.018,
        );
        const gap = (length - count * size) / (count + 1);

        result.centers.forEach((center, index) => {
            expect(center?.y_m).toBeCloseTo(
                gap * (index + 1) + index * size + size / 2,
                12,
            );
        });
    });

    test('itens de tamanhos diferentes não se sobrepõem e mantêm a ordem', () => {
        const items = [round(0.28), { w_m: 0.05, h_m: 0.2 }, round(0.1)];
        const result = layoutRow({ w_m: 0.43, h_m: 0.67 }, items, 0.018);
        const spans = result.centers.map((center, index) => {
            const extent = items[index].h_m;

            return [
                (center?.y_m ?? 0) - extent / 2,
                (center?.y_m ?? 0) + extent / 2,
            ];
        });

        expect(spans[0][1]).toBeLessThanOrEqual(spans[1][0]);
        expect(spans[1][1]).toBeLessThanOrEqual(spans[2][0]);
        expect(spans[0][0]).toBeGreaterThanOrEqual(0);
        expect(spans[2][1]).toBeLessThanOrEqual(0.67);
    });

    test('o duto retangular usa a altura no eixo vertical e a largura no horizontal', () => {
        const rect = { w_m: 0.05, h_m: 0.2 };
        const vertical = layoutRow({ w_m: 0.4, h_m: 0.6 }, [rect], 0.018);
        const horizontal = layoutRow({ w_m: 0.6, h_m: 0.4 }, [rect], 0.018);

        // 0,2 de altura na fila vertical; 0,05 de largura na fila horizontal.
        expect(vertical.tooBig).toBe(false);
        expect(horizontal.tooBig).toBe(false);
        expect(horizontal.centers[0]?.x_m).toBeCloseTo(0.3, 12);
    });

    test('itens sem medida ficam fora do cálculo', () => {
        const result = layoutRow(
            { w_m: 0.4, h_m: 0.6 },
            [{}, round(0.2), {}],
            0.018,
        );

        expect(result.centers[0]).toBeUndefined();
        expect(result.centers[2]).toBeUndefined();
        expect(result.centers[1]?.y_m).toBeCloseTo(0.3, 12);
    });

    test('soma maior que o lado maior: não cabe e não há posições', () => {
        const result = layoutRow(
            { w_m: 0.4, h_m: 0.5 },
            [round(0.3), round(0.3)],
            0.018,
        );

        expect(result.doNotFit).toBe(true);
        expect(result.centers).toEqual([undefined, undefined]);
    });

    test('sobra menor que a espessura: justo', () => {
        const between = layoutRow(
            { w_m: 0.4, h_m: 0.6 },
            [round(0.28), round(0.28)],
            0.018,
        );
        const edge = layoutRow({ w_m: 0.3, h_m: 0.6 }, [round(0.29)], 0.018);

        expect(between.doNotFit).toBe(false);
        expect(between.tight).toBe(true);
        expect(edge.tight).toBe(true);
        expect(edge.tooBig).toBe(false);
    });

    test('extensão no lado menor maior que o lado menor: grande demais', () => {
        const result = layoutRow({ w_m: 0.3, h_m: 0.6 }, [round(0.31)], 0.018);

        expect(result.tooBig).toBe(true);
        expect(result.tight).toBe(true);
    });

    test('sem itens não há nada a avisar', () => {
        expect(layoutRow({ w_m: 0.3, h_m: 0.6 }, [], 0.018)).toEqual({
            centers: [],
            doNotFit: false,
            tight: false,
            tooBig: false,
        });
    });
});
