import { expect, test } from 'vite-plus/test';
import {
    ANALYSIS_FREQUENCIES_HZ,
    ANALYSIS_MAX_HZ,
    CHART_MAX_HZ,
    FREQUENCIES_HZ,
} from './frequencies';

function expectConstantStep(grid: readonly number[], until = grid.length) {
    const step = Math.log10(grid[1] / grid[0]);

    for (let index = 1; index < until; index++) {
        expect(Math.log10(grid[index] / grid[index - 1])).toBeCloseTo(step, 12);
    }
}

test('grade de análise de 10 Hz a 1000 Hz com passo log constante', () => {
    expect(ANALYSIS_FREQUENCIES_HZ).toHaveLength(361);
    expect(ANALYSIS_FREQUENCIES_HZ[0]).toBe(10);
    expect(ANALYSIS_FREQUENCIES_HZ.at(-1)).toBeCloseTo(ANALYSIS_MAX_HZ, 9);
    expectConstantStep(ANALYSIS_FREQUENCIES_HZ);
});

test('grade das curvas repete a de análise e segue até 20 kHz', () => {
    expect(FREQUENCIES_HZ[0]).toBe(10);
    expect(FREQUENCIES_HZ.at(-1)).toBe(CHART_MAX_HZ);
    expect(FREQUENCIES_HZ.slice(0, ANALYSIS_FREQUENCIES_HZ.length)).toEqual([
        ...ANALYSIS_FREQUENCIES_HZ,
    ]);
    // Passo constante até o último ponto, que só completa os 20 kHz.
    expectConstantStep(FREQUENCIES_HZ, FREQUENCIES_HZ.length - 1);

    for (let index = 1; index < FREQUENCIES_HZ.length; index++) {
        expect(FREQUENCIES_HZ[index]).toBeGreaterThan(
            FREQUENCIES_HZ[index - 1],
        );
    }
});
