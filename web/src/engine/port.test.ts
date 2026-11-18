import { describe, expect, test } from 'vite-plus/test';
import { SPEED_OF_SOUND } from './constants';
import { netVolume, portArea, portLength, tuningForLength } from './port';

const ROUND_AREA = (Math.PI * 0.1 ** 2) / 4;

describe('portArea', () => {
    test('área de um duto por formato', () => {
        expect(
            portArea({ shape: 'round', diameter_m: 0.1, count: 1 }),
        ).toBeCloseTo(ROUND_AREA, 12);
        expect(
            portArea({ shape: 'rect', width_m: 0.05, height_m: 0.2, count: 1 }),
        ).toBeCloseTo(0.01, 12);
        expect(
            portArea({
                shape: 'triangle',
                base_m: 0.1,
                height_m: 0.2,
                count: 1,
            }),
        ).toBeCloseTo(0.01, 12);
        expect(
            portArea({ shape: 'rect', width_m: 0.05, count: 1 }),
        ).toBeUndefined();
    });
});

describe('portLength', () => {
    test('R6 — forma de [D06] com a constante do nosso c (0,1 %)', () => {
        // Lv[cm] = K·D²/(Fb²·Vb) − 0,732·D, D em cm e Vb em litros, K = c²/(16π·1000) com c em cm/s.
        const c = SPEED_OF_SOUND * 100;
        const k = c ** 2 / (16 * Math.PI * 1000);
        const expectedCm = (k * 10 ** 2) / (35 ** 2 * 50) - 0.732 * 10;
        const length = portLength({
            fb_hz: 35,
            volume_m3: 0.05,
            area_m2: ROUND_AREA,
            count: 1,
        });

        expect(Math.abs(length * 100 - expectedCm) / expectedCm).toBeLessThan(
            0.001,
        );
    });

    test('R7 — retangular e triangular com a mesma área dão o mesmo comprimento', () => {
        const round = portLength({
            fb_hz: 35,
            volume_m3: 0.05,
            area_m2: ROUND_AREA,
            count: 1,
        });
        const rect = portArea({
            shape: 'rect',
            width_m: 0.05,
            height_m: ROUND_AREA / 0.05,
            count: 1,
        });
        const triangle = portArea({
            shape: 'triangle',
            base_m: 0.1,
            height_m: (2 * ROUND_AREA) / 0.1,
            count: 1,
        });

        for (const area of [rect, triangle]) {
            const length = portLength({
                fb_hz: 35,
                volume_m3: 0.05,
                area_m2: area ?? 0,
                count: 1,
            });
            expect(Math.abs(length - round) / round).toBeLessThan(0.005);
        }
    });

    test('2 dutos iguais pedem duto mais longo, conforme a área total', () => {
        const one = portLength({
            fb_hz: 35,
            volume_m3: 0.05,
            area_m2: ROUND_AREA,
            count: 1,
        });
        const two = portLength({
            fb_hz: 35,
            volume_m3: 0.05,
            area_m2: ROUND_AREA,
            count: 2,
        });

        expect(two).toBeGreaterThan(one * 1.8);
    });
});

describe('netVolume', () => {
    test('R14 — Vb_líq + volume do duto + N·Vd = Vb', () => {
        const result = netVolume({
            vb_m3: 0.1,
            drivers_m3: 2 * 0.003,
            fb_hz: 35,
            area_m2: ROUND_AREA,
            count: 1,
        });

        expect(
            Math.abs(result.net_m3 + result.port_m3 + 0.006 - 0.1) / 0.1,
        ).toBeLessThan(1e-6);
        expect(result.length_m).toBeCloseTo(
            portLength({
                fb_hz: 35,
                volume_m3: result.net_m3,
                area_m2: ROUND_AREA,
                count: 1,
            }),
            9,
        );
    });

    test('duto que não cabe devolve volume líquido inválido', () => {
        const result = netVolume({
            vb_m3: 0.005,
            drivers_m3: 0,
            fb_hz: 15,
            area_m2: 0.03,
            count: 4,
        });

        expect(result.net_m3).toBeLessThanOrEqual(0);
    });
});

describe('tuningForLength — sintonia a partir da profundidade', () => {
    test('é o inverso de netVolume: o comprimento de uma Fb devolve a mesma Fb', () => {
        const base = {
            vb_m3: 0.06,
            drivers_m3: 0.002,
            area_m2: 0.005,
            count: 2,
            end_factor: 0.732,
        };
        const solved = netVolume({ ...base, fb_hz: 35 });

        expect(
            tuningForLength({ ...base, length_m: solved.length_m }),
        ).toBeCloseTo(35, 6);
    });

    test('duto que ocupa a caixa toda não tem sintonia', () => {
        expect(
            tuningForLength({
                length_m: 10,
                vb_m3: 0.06,
                drivers_m3: 0,
                area_m2: 0.01,
                count: 1,
            }),
        ).toBeUndefined();
    });
});
