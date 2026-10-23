import { describe, expect, test } from 'vite-plus/test';
import { frequencySplits, frequencyTick, peakOf, yTicks } from './axes';

describe('peakOf', () => {
    const frequencies = [10, 20, 40, 80, 160];

    test('devolve o maior valor dentro da faixa', () => {
        expect(peakOf(frequencies, [1, 5, 9, 3, 12], [10, 100])).toEqual({
            index: 2,
            value: 9,
        });
    });

    test('ignora null e pontos fora da faixa', () => {
        expect(peakOf(frequencies, [null, 5, null, 3, 12], [10, 100])).toEqual({
            index: 1,
            value: 5,
        });
    });

    test('sem ponto válido não há pico', () => {
        expect(
            peakOf(frequencies, [null, null, null, null, null], [10, 100]),
        ).toBe(undefined);
    });
});

describe('grade de frequência', () => {
    test('de 10 Hz a 1 kHz usa 1…9 de cada década', () => {
        const ticks = frequencySplits(10, 1000);

        expect(ticks).toContain(10);
        expect(ticks).toContain(50);
        expect(ticks).toContain(1000);
        expect(ticks).not.toContain(15);
    });

    test('zoom estreito ganha mais pontos até ter ao menos quatro', () => {
        const ticks = frequencySplits(40, 60);

        expect(ticks.length).toBeGreaterThanOrEqual(4);
        ticks.forEach((tick) => {
            expect(tick).toBeGreaterThanOrEqual(40);
            expect(tick).toBeLessThanOrEqual(60);
        });
    });

    test('só 1, 2 e 5 recebem rótulo, a menos que "all"', () => {
        expect(frequencyTick(20, false)).toBe('20');
        expect(frequencyTick(30, false)).toBe('');
        expect(frequencyTick(30, true)).toBe('30');
        expect(frequencyTick(1000, false)).toBe('1k');
        expect(frequencyTick(null, true)).toBe('');
    });
});

describe('yTicks', () => {
    test('degraus bonitos que cobrem o intervalo, de 4 a 8', () => {
        const ticks = yTicks(0, 47);

        expect(ticks.length).toBeGreaterThanOrEqual(4);
        expect(ticks.length).toBeLessThanOrEqual(9);
        expect(ticks[0]).toBeGreaterThanOrEqual(0);
        expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(47);
        const step = ticks[1] - ticks[0];
        expect(
            [1, 2, 5, 10].includes(step / 10 ** Math.floor(Math.log10(step))),
        ).toBe(true);
    });

    test('respeita a lista de degraus permitidos', () => {
        const ticks = yTicks(-36, 6, [3, 6, 12]);

        expect([3, 6, 12]).toContain(ticks[1] - ticks[0]);
        expect(ticks[0]).toBeGreaterThanOrEqual(-36);
    });

    test('intervalo vazio não trava', () => {
        expect(yTicks(5, 5).length).toBeGreaterThan(0);
    });
});
