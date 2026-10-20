import { expect, test } from 'vite-plus/test';
import { FREQUENCIES_HZ } from './frequencies';

test('grade de 10 Hz a 1000 Hz com passo log constante', () => {
    expect(FREQUENCIES_HZ).toHaveLength(361);
    expect(FREQUENCIES_HZ[0]).toBe(10);
    expect(FREQUENCIES_HZ[FREQUENCIES_HZ.length - 1]).toBeCloseTo(1000, 9);

    const step = Math.log10(FREQUENCIES_HZ[1] / FREQUENCIES_HZ[0]);

    for (let index = 1; index < FREQUENCIES_HZ.length; index++) {
        expect(
            Math.log10(FREQUENCIES_HZ[index] / FREQUENCIES_HZ[index - 1]),
        ).toBeCloseTo(step, 12);
    }
});
