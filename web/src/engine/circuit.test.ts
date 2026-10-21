import { expect, test } from 'vite-plus/test';
import { abs, add, complex, mul, scale, sub } from './complex';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { solveCircuit } from './circuit';
import type { CircuitParams } from './circuit';

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

// Driver de referência (Fs 28 Hz, Qes 0,42, Qms 4,1, Vas 85 L, Re 3,6 Ω, Sd 491 cm², Le = 0) pelas
// definições de [S72]; a caixa fica por conta de cada teste.
function referenceDriver(): Omit<CircuitParams, 'cab' | 'ral'> {
    const omegaS = 2 * Math.PI * 28;
    const re = 3.6;
    const sd = 0.0491;
    const cms = 0.085 / (AIR_DENSITY * SPEED_OF_SOUND ** 2 * sd ** 2);
    const mms = 1 / (omegaS ** 2 * cms);

    return {
        re,
        le: 0,
        bl: Math.sqrt((omegaS * mms * re) / 0.42),
        mms,
        cms,
        rms: (omegaS * mms) / 4.1,
        sd,
    };
}

const compliance = (volume: number) =>
    volume / (AIR_DENSITY * SPEED_OF_SOUND ** 2);
const SAMPLE_HZ = [12, 25, 40, 55, 80, 120, 300];
const db = (value: number) => 20 * Math.log10(value);

// B4 — bandpass 4ª ordem: câmara frontal e duto desprezíveis (Cf → 0, Map → 0) deixam o duto
// como um tubo sem massa, Up = Ud, e a carga é só a câmara traseira: vira a caixa selada ([L10]).
test('B4 — limite Cf → 0 e Map → 0: a bandpass vira a caixa selada', () => {
    const rear = compliance(0.05);
    const closed: CircuitParams = {
        ...referenceDriver(),
        cab: rear,
        ral: Number.POSITIVE_INFINITY,
    };
    const bandpass: CircuitParams = {
        ...referenceDriver(),
        cab: 1e-12,
        ral: Number.POSITIVE_INFINITY,
        map: 1e-12,
        rear: { cab: rear, ral: Number.POSITIVE_INFINITY },
    };

    for (const frequency of SAMPLE_HZ) {
        const expected = abs(solveCircuit(closed, frequency).radiated);
        const actual = abs(solveCircuit(bandpass, frequency).radiated);

        expect(Math.abs(db(actual / expected)), `${frequency} Hz`).toBeLessThan(
            0.05,
        );
    }
});

// B5 — câmara traseira infinitamente complacente (aberta): o cone só vê a câmara frontal e o
// fluxo no duto é o da caixa dutada com o mesmo volume e a mesma massa de duto.
test('B5 — limite Cr → ∞: o fluxo do duto é o da caixa dutada', () => {
    const front = compliance(0.06);
    const map = 1 / ((2 * Math.PI * 45) ** 2 * front);
    const vented: CircuitParams = {
        ...referenceDriver(),
        cab: front,
        ral: Number.POSITIVE_INFINITY,
        map,
    };
    const bandpass: CircuitParams = {
        ...vented,
        rear: { cab: 1e6, ral: Number.POSITIVE_INFINITY },
    };

    for (const frequency of SAMPLE_HZ) {
        const expected = abs(solveCircuit(vented, frequency).port);
        const actual = abs(solveCircuit(bandpass, frequency).port);

        expect(Math.abs(db(actual / expected)), `${frequency} Hz`).toBeLessThan(
            0.05,
        );
    }
});

// B7 — conservação de volume na câmara frontal: o que o cone desloca vira compressão do ar da
// câmara (jω·Cf·pf), vazamento (pf/Ralf) ou fluxo no duto (Up).
test('B7 — Ud = jω·Cf·pf + pf/Ralf + Up em cada frequência', () => {
    const front = compliance(0.06);
    const ralFront = 7 / (2 * Math.PI * 45 * front);
    const map = 1 / ((2 * Math.PI * 45) ** 2 * front);
    const params: CircuitParams = {
        ...referenceDriver(),
        cab: front,
        ral: ralFront,
        map,
        rear: {
            cab: compliance(0.04),
            ral: 7 / (2 * Math.PI * 60 * compliance(0.04)),
        },
    };

    for (const frequency of SAMPLE_HZ) {
        const omega = 2 * Math.PI * frequency;
        const jw = complex(0, omega);
        const point = solveCircuit(params, frequency);
        const cone = scale(point.velocity, params.sd);
        const pressure = mul(point.port, scale(jw, map));
        const leaked = scale(pressure, 1 / ralFront);
        const compressed = scale(mul(jw, pressure), front);
        const total = add(add(compressed, leaked), point.port);

        expect(
            abs(sub(cone, total)) / abs(cone),
            `${frequency} Hz`,
        ).toBeLessThan(1e-9);
    }
});
