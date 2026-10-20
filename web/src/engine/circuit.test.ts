import { expect, test } from 'vite-plus/test';
import { abs } from './complex';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { solveCircuit } from './circuit';

// R5 (contracts/engine.md): driver ao ar livre tem o pico de impedância em Fs com
// |Z| = Re·(1 + Qms/Qes) ([S72]).
test('R5 — impedância ao ar livre: pico em Fs com Re·(1 + Qms/Qes)', () => {
    const fs = 28;
    const re = 3.6;
    const qes = 0.42;
    const qms = 4.1;
    const sd = 0.0491;
    const cms = 0.085 / (AIR_DENSITY * SPEED_OF_SOUND ** 2 * sd ** 2);
    const mms = 1 / ((2 * Math.PI * fs) ** 2 * cms);
    const bl = Math.sqrt((2 * Math.PI * fs * mms * re) / qes);
    const params = {
        re,
        le: 0,
        bl,
        mms,
        cms,
        rms: (2 * Math.PI * fs * mms) / qms,
        sd,
        // Caixa enorme = ar livre.
        cab: 1e4 / (AIR_DENSITY * SPEED_OF_SOUND ** 2),
        ral: Number.POSITIVE_INFINITY,
    };

    let peak = { frequency: 0, magnitude: 0 };

    for (let frequency = 20; frequency <= 40; frequency += 0.01) {
        const magnitude = abs(solveCircuit(params, frequency).impedance);

        if (magnitude > peak.magnitude) {
            peak = { frequency, magnitude };
        }
    }

    expect(Math.abs(peak.frequency - fs) / fs).toBeLessThan(0.005);
    expect(
        Math.abs(peak.magnitude - re * (1 + qms / qes)) /
            (re * (1 + qms / qes)),
    ).toBeLessThan(0.005);
});
