import { expect, test } from 'vite-plus/test';
import { abs, add, complex, mul, scale, sub } from './complex';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { solveCircuit } from './circuit';
import type { CircuitParams } from './circuit';

// R5: driver ao ar livre tem o pico de impedância em Fs com
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

// Bandpass de 6ª ordem: a câmara traseira ganha um duto que irradia para fora.
const tuningMap = (volume: number, tuning_hz: number) =>
    1 / ((2 * Math.PI * tuning_hz) ** 2 * compliance(volume));

function sixthOrder(
    overrides: Partial<CircuitParams> = {},
    rear: Partial<NonNullable<CircuitParams['rear']>> = {},
): CircuitParams {
    return {
        ...referenceDriver(),
        cab: compliance(0.04),
        ral: Number.POSITIVE_INFINITY,
        map: tuningMap(0.04, 70),
        rear: {
            cab: compliance(0.08),
            ral: Number.POSITIVE_INFINITY,
            map: tuningMap(0.08, 30),
            ...rear,
        },
        ...overrides,
    };
}

// T4 — duto traseiro fechado (massa de ar enorme): a 6ª ordem vira a 4ª ordem de mesmas câmaras.
test('T4 — limite do duto traseiro fechado: a 6ª ordem vira a bandpass de 4ª ordem', () => {
    const six = sixthOrder({}, { map: 1e9 });
    const four: CircuitParams = {
        ...six,
        rear: { cab: compliance(0.08), ral: Number.POSITIVE_INFINITY },
    };

    for (const frequency of SAMPLE_HZ) {
        const expected = abs(solveCircuit(four, frequency).radiated);
        const actual = abs(solveCircuit(six, frequency).radiated);

        expect(Math.abs(db(actual / expected)), `${frequency} Hz`).toBeLessThan(
            0.1,
        );
    }
});

test('sem duto traseiro o ponto não traz fluxo traseiro (a 4ª ordem fica idêntica)', () => {
    const four = sixthOrder();
    delete four.rear?.map;

    for (const frequency of SAMPLE_HZ) {
        const point = solveCircuit(four, frequency);

        expect(abs(point.rearPort), `${frequency} Hz`).toBe(0);
        expect(point.radiated).toEqual(point.port);
    }
});

// T5 — o driver fica entre as câmaras: trocar os parâmetros das duas só inverte o sinal da saída.
test('T5 — simetria: trocar as câmaras dá o mesmo módulo e fase girada 180°', () => {
    const a = sixthOrder();
    const b: CircuitParams = {
        ...a,
        cab: a.rear?.cab ?? 0,
        ral: a.rear?.ral ?? 0,
        map: a.rear?.map,
        rear: { cab: a.cab, ral: a.ral, map: a.map },
    };

    for (const frequency of SAMPLE_HZ) {
        const first = solveCircuit(a, frequency).radiated;
        const second = solveCircuit(b, frequency).radiated;

        expect(
            abs(add(first, second)) / abs(first),
            `${frequency} Hz`,
        ).toBeLessThan(1e-9);
    }
});

// T6 — com a mesma sintonia nas duas câmaras e sem perdas, as saídas dos dois dutos se cancelam.
test('T6 — sintonias iguais, sem perdas: a saída some (< −100 dB do deslocamento do cone)', () => {
    const params = sixthOrder(
        { map: tuningMap(0.04, 45) },
        { map: tuningMap(0.08, 45) },
    );

    for (const frequency of SAMPLE_HZ) {
        const point = solveCircuit(params, frequency);
        const cone = abs(scale(point.velocity, params.sd));

        expect(abs(point.radiated) / cone, `${frequency} Hz`).toBeLessThan(
            1e-5,
        );
    }
});

// T8 — conservação de volume nas duas câmaras (com perdas): o que o cone desloca vira compressão,
// vazamento ou fluxo no duto; do lado de trás o sinal é o oposto (o cone rarefaz a câmara).
test('T8 — conservação de volume na câmara frontal e na traseira', () => {
    const front = compliance(0.04);
    const rear = compliance(0.08);
    const mapFront = tuningMap(0.04, 70);
    const mapRear = tuningMap(0.08, 30);
    const ralFront = 7 / (2 * Math.PI * 70 * front);
    const ralRear = 7 / (2 * Math.PI * 30 * rear);
    const params = sixthOrder({ ral: ralFront }, { ral: ralRear });

    for (const frequency of SAMPLE_HZ) {
        const jw = complex(0, 2 * Math.PI * frequency);
        const point = solveCircuit(params, frequency);
        const cone = scale(point.velocity, params.sd);

        const pf = mul(point.port, scale(jw, mapFront));
        const frontTotal = add(
            add(scale(mul(jw, pf), front), scale(pf, 1 / ralFront)),
            point.port,
        );

        expect(
            abs(sub(cone, frontTotal)) / abs(cone),
            `frente ${frequency} Hz`,
        ).toBeLessThan(1e-9);

        const pr = mul(point.rearPort, scale(jw, mapRear));
        const rearTotal = add(
            add(scale(mul(jw, pr), rear), scale(pr, 1 / ralRear)),
            point.rearPort,
        );

        expect(
            abs(add(cone, rearTotal)) / abs(cone),
            `trás ${frequency} Hz`,
        ).toBeLessThan(1e-9);
        expect(abs(sub(point.radiated, add(point.port, point.rearPort)))).toBe(
            0,
        );
    }
});
