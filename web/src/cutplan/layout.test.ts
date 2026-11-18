import { describe, expect, test } from 'vite-plus/test';
import { checkCutouts, layoutEdge, layoutRow, trianglePoints } from './layout';
import type { Cutout } from './types';

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

describe('checkCutouts', () => {
    const panel = { w_m: 0.5, h_m: 0.8 };
    const web = 0.018;
    const at = (
        n: number,
        x_m: number,
        y_m: number,
        manual = true,
        diameter_m = 0.2,
    ): Cutout => ({
        kind: 'driver',
        shape: 'round',
        diameter_m,
        center: { x_m, y_m },
        ref: { piece: 'front', kind: 'driver', n },
        ...(manual ? { manual: true as const } : {}),
    });

    test('recorte manual bem colocado não gera aviso', () => {
        expect(checkCutouts(panel, [at(1, 0.25, 0.4)], web)).toEqual([]);
    });

    test('dois recortes sobrepostos ou a menos da espessura: um aviso para cada', () => {
        for (const y of [0.55, 0.61]) {
            expect(
                checkCutouts(
                    panel,
                    [at(1, 0.25, 0.4), at(2, 0.25, y, false)],
                    web,
                ),
            ).toEqual([
                {
                    ref: { piece: 'front', kind: 'driver', n: 1 },
                    id: 'cutoutOverlap',
                },
                {
                    ref: { piece: 'front', kind: 'driver', n: 2 },
                    id: 'cutoutOverlap',
                },
            ]);
        }

        expect(
            checkCutouts(panel, [at(1, 0.25, 0.2), at(2, 0.25, 0.62)], web),
        ).toEqual([]);
    });

    test('borda na faixa de colagem avisa; além da peça é erro e vence a faixa', () => {
        expect(checkCutouts(panel, [at(1, 0.11, 0.4)], web)).toEqual([
            {
                ref: { piece: 'front', kind: 'driver', n: 1 },
                id: 'cutoutInGlueBand',
            },
        ]);
        expect(checkCutouts(panel, [at(1, 0.09, 0.4)], web)).toEqual([
            {
                ref: { piece: 'front', kind: 'driver', n: 1 },
                id: 'cutoutOutside',
            },
        ]);
    });

    test('recortes automáticos entre si ficam com os avisos da fila', () => {
        expect(
            checkCutouts(
                panel,
                [at(1, 0.05, 0.4, false), at(2, 0.05, 0.45, false)],
                web,
            ),
        ).toEqual([]);
    });

    test('o triangular é medido pelo retângulo que o envolve', () => {
        const triangle: Cutout = {
            kind: 'port',
            shape: 'triangle',
            base_m: 0.3,
            height_m: 0.1,
            center: { x_m: 0.16, y_m: 0.4 },
            ref: { piece: 'front', kind: 'port', n: 1 },
            manual: true,
        };

        expect(checkCutouts(panel, [triangle], web)).toEqual([
            {
                ref: { piece: 'front', kind: 'port', n: 1 },
                id: 'cutoutInGlueBand',
            },
        ]);
    });
});

describe('layoutEdge — dutos retangulares/triangulares numa extremidade', () => {
    const panel = { w_m: 0.34, h_m: 0.55 };
    const driver = { w_m: 0.28, h_m: 0.28 };
    const slot = { w_m: 0.25, h_m: 0.05 };

    test('duto embaixo, encostado na folga, e alto-falante centrado no resto', () => {
        const { centers, doNotFit } = layoutEdge(
            panel,
            [driver, slot],
            [false, true],
            0.018,
        );

        expect(doNotFit).toBe(false);
        expect(centers[1]).toEqual({ x_m: 0.17, y_m: 0.018 + 0.025 });
        expect(centers[0]!.x_m).toBeCloseTo(0.17);
        expect(centers[0]!.y_m).toBeGreaterThan(0.036 + 0.05 + 0.14 - 1e-9);
    });

    test('vários dutos ficam lado a lado no lado menor', () => {
        const tri = { w_m: 0.08, h_m: 0.07 };
        const { centers } = layoutEdge(
            panel,
            [driver, tri, tri],
            [false, true, true],
            0.018,
        );

        expect(centers[1]!.y_m).toBeCloseTo(centers[2]!.y_m);
        expect(centers[1]!.x_m).toBeLessThan(centers[2]!.x_m);
    });

    test('dutos que não cabem lado a lado voltam à fila única', () => {
        const wide = { w_m: 0.11, h_m: 0.11 };
        const items = [driver, wide, wide, wide, wide];
        const edge = [false, true, true, true, true];

        expect(layoutEdge(panel, items, edge, 0.018)).toEqual(
            layoutRow(panel, items, 0.018),
        );
    });
});

describe('layoutEdge — borda, canto e parede escolhidos', () => {
    const panel = { w_m: 0.34, h_m: 0.55 };
    const driver = { w_m: 0.28, h_m: 0.28 };
    const tri = { w_m: 0.08, h_m: 0.07 };

    test('em cima: o duto encosta na borda de cima e o alto-falante fica abaixo', () => {
        const { centers } = layoutEdge(
            panel,
            [driver, tri],
            [false, true],
            0.018,
            {
                side: 'top',
            },
        );

        expect(centers[1]!.y_m).toBeCloseTo(0.55 - 0.018 - 0.035);
        expect(centers[0]!.y_m).toBeLessThan(centers[1]!.y_m);
    });

    test('à direita: dutos em pé na lateral direita', () => {
        const { centers } = layoutEdge(
            panel,
            [driver, tri],
            [false, true],
            0.018,
            {
                side: 'right',
            },
        );

        expect(centers[1]!.x_m).toBeCloseTo(0.34 - 0.018 - 0.04);
    });

    test('canto inferior esquerdo: rente às paredes internas (folga da madeira)', () => {
        const { centers } = layoutEdge(
            panel,
            [driver, tri],
            [false, true],
            0.018,
            {
                side: 'bottom',
                align: 'start',
            },
        );

        expect(centers[1]!.x_m).toBeCloseTo(0.018 + 0.04);
        expect(centers[1]!.y_m).toBeCloseTo(0.018 + 0.035);
    });

    test('canto inferior direito: dois dutos encostados no fim da borda', () => {
        const { centers } = layoutEdge(
            panel,
            [driver, tri, tri],
            [false, true, true],
            0.018,
            { side: 'bottom', align: 'end' },
        );

        expect(centers[2]!.x_m).toBeCloseTo(0.34 - 0.018 - 0.04);
        expect(centers[1]!.x_m).toBeCloseTo(0.34 - 0.018 - 0.08 - 0.018 - 0.04);
    });
});

describe('trianglePoints — giro do triangular', () => {
    test('sem giro a ponta fica em cima; a 90° aponta para a esquerda', () => {
        const up = trianglePoints(0, 0, 0.1, 0.08);
        const left = trianglePoints(0, 0, 0.1, 0.08, 90);

        expect(up[2]).toEqual([0, 0.04]);
        expect(left[2]![0]).toBeCloseTo(-0.04);
        expect(left[2]![1]).toBeCloseTo(0);
    });
});
