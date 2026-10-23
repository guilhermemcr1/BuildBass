import { describe, expect, test } from 'vite-plus/test';
import { abs, add, arg, complex, div, mul } from './complex';
import type { Complex } from './complex';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { FREQUENCIES_HZ } from './frequencies';
import { simulate } from './simulate';
import type { BoxInput, DriverInput, ProjectInput } from './types';

// Bandpass de 6ª ordem (specs/007): verificação do motor contra a função de transferência fechada
// de research.md §3, avaliada aqui com polinômios e Horner, sem usar `solveCircuit`.
//
// T18 (exemplo numérico de livro) está PENDENTE: [D06] e [G89] não estavam acessíveis. SC-002 é
// atendido pela verificação analítica (T1, T2, T7, T9) e pelo limite do duto traseiro fechado (T4,
// em circuit.test.ts); a lacuna está registrada em specs/007-bandpass-6a-ordem/quickstart.md.

const LOSSLESS = Number.POSITIVE_INFINITY;
const RHO_C2 = AIR_DENSITY * SPEED_OF_SOUND ** 2;

// Driver de referência coerente, sem indutância (Le = 0) para casar com a função analítica.
const REFERENCE: DriverInput = {
    fs_hz: 28,
    qes: 0.42,
    qms: 4.1,
    vas_m3: 0.085,
    re_ohm: 3.6,
    sd_m2: 0.0491,
    le_h: 0,
};

function sixth(
    box: Partial<BoxInput> = {},
    driver: DriverInput = REFERENCE,
    extra: Partial<ProjectInput> = {},
): ProjectInput {
    return {
        name: 'bandpass 6',
        driver,
        drivers: { count: 1, wiring: 'parallel' },
        box: {
            type: 'bandpass6',
            vr_m3: 0.08,
            vf_m3: 0.04,
            fb_hz: 70,
            fb_rear_hz: 30,
            ql: LOSSLESS,
            // Sem medidas: os dutos não ocupam volume e só as sintonias contam.
            port: { shape: 'round', count: 1 },
            port_rear: { shape: 'round', count: 1 },
            ...box,
        },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
        ...extra,
    };
}

// Polinômios em s com coeficientes reais, índice = potência.
type Poly = number[];

const addPoly = (a: Poly, b: Poly): Poly =>
    Array.from(
        { length: Math.max(a.length, b.length) },
        (_, i) => (a[i] ?? 0) + (b[i] ?? 0),
    );
const scalePoly = (a: Poly, k: number): Poly => a.map((c) => c * k);
const mulPoly = (a: Poly, b: Poly): Poly => {
    const out = Array.from({ length: a.length + b.length - 1 }, () => 0);

    a.forEach((x, i) => b.forEach((y, j) => (out[i + j] += x * y)));

    return out;
};

// Horner em s complexo.
const evalPoly = (p: Poly, s: Complex): Complex =>
    [...p]
        .reverse()
        .reduce((sum, c) => add(mul(sum, s), complex(c)), complex(0));

type Tuning = { vr: number; vf: number; fb: number; fbr: number };

//   U0/V   = Bl·Sd·(ar − af)·s³ / P6(s)
//   Zin    = Re + Bl²·s·D / Q(s)
//   D      = (1 + af·s²)(1 + ar·s²),  af = Mapf·Cf, ar = Mapr·Cr
//   Q(s)   = (Mms·s² + Rms·s + 1/Cms)·D + Sd²·s²·(Mapf·(1 + ar·s²) + Mapr·(1 + af·s²))
//   P6(s)  = Re·Q(s) + Bl²·s·D
function analytic(t: Tuning, driver = REFERENCE) {
    const re = driver.re_ohm as number;
    const sd = driver.sd_m2 as number;
    const omegaS = 2 * Math.PI * (driver.fs_hz as number);
    const cms = (driver.vas_m3 as number) / (RHO_C2 * sd ** 2);
    const mms = 1 / (omegaS ** 2 * cms);
    const bl = Math.sqrt((omegaS * mms * re) / (driver.qes as number));
    const rms = (omegaS * mms) / (driver.qms as number);
    const cr = t.vr / RHO_C2;
    const cf = t.vf / RHO_C2;
    const mapF = 1 / ((2 * Math.PI * t.fb) ** 2 * cf);
    const mapR = 1 / ((2 * Math.PI * t.fbr) ** 2 * cr);
    const af = mapF * cf;
    const ar = mapR * cr;

    const d = mulPoly([1, 0, af], [1, 0, ar]);
    const mechanical = [1 / cms, rms, mms];
    const q = addPoly(
        mulPoly(mechanical, d),
        scalePoly(
            addPoly(
                mulPoly([0, 0, 1], scalePoly([1, 0, ar], mapF)),
                mulPoly([0, 0, 1], scalePoly([1, 0, af], mapR)),
            ),
            sd ** 2,
        ),
    );
    const sd1 = mulPoly([0, 1], d);
    const p6 = addPoly(scalePoly(q, re), scalePoly(sd1, bl ** 2));
    const numerator: Poly = [0, 0, 0, bl * sd * (ar - af)];

    // Volume total radiado pelos dois dutos por volt, m³/s/V.
    const outflow = (frequency: number): Complex => {
        const s = complex(0, 2 * Math.PI * frequency);

        return div(evalPoly(numerator, s), evalPoly(p6, s));
    };

    return {
        outflow,
        impedance: (frequency: number): Complex => {
            const s = complex(0, 2 * Math.PI * frequency);

            return add(
                complex(re),
                scalePointwise(div(evalPoly(sd1, s), evalPoly(q, s)), bl ** 2),
            );
        },
        groupDelay: (frequency: number): number => {
            const step = 1e-5;
            const phase = (f: number) =>
                arg(mul(complex(0, 2 * Math.PI * f), outflow(f)));
            const before = frequency * (1 - step);
            const after = frequency * (1 + step);
            const change = phase(after) - phase(before);
            const wrapped = Math.atan2(Math.sin(change), Math.cos(change));

            return -wrapped / (2 * Math.PI * (after - before));
        },
    };
}

function scalePointwise(value: Complex, k: number): Complex {
    return complex(value.re * k, value.im * k);
}

const levelDb = (outflow: Complex, frequency: number, voltage: number) => {
    const omega = 2 * Math.PI * frequency;
    const pressure =
        (omega * AIR_DENSITY * abs(outflow) * voltage) / (2 * Math.PI);

    return 20 * Math.log10(pressure / 20e-6);
};

const CASE: Tuning = { vr: 0.08, vf: 0.04, fb: 70, fbr: 30 };

describe('bandpass 6ª ordem — contra a função de transferência analítica (T1, T2, T3, T7)', () => {
    const result = simulate(sixth());
    const reference = analytic(CASE);
    const voltage = Math.sqrt(1 * 3.6);
    const indices = [0, 20, 40, 60, 80, 100, 120, 140, 160, 200, 260, 340, 360];

    test('as curvas existem na grade inteira (dutos sem medidas não têm velocidade)', () => {
        for (const curve of [
            'spl_db',
            'excursion_m',
            'impedance_ohm',
            'group_delay_s',
        ] as const) {
            expect(result.curves[curve], curve).toHaveLength(
                FREQUENCIES_HZ.length,
            );
        }

        expect(result.curves.port_velocity_ms).toBeUndefined();
        expect(result.curves.port_rear_velocity_ms).toBeUndefined();
    });

    test('T1 — SPL do motor = SPL do polinômio (0,01 dB)', () => {
        const spl = result.curves.spl_db ?? [];

        for (const index of indices) {
            const frequency = FREQUENCIES_HZ[index];
            const expected = levelDb(
                reference.outflow(frequency),
                frequency,
                voltage,
            );

            expect(
                Math.abs(spl[index] - expected),
                `${frequency.toFixed(1)} Hz`,
            ).toBeLessThan(0.01);
        }
    });

    test('T2 — atraso de grupo do motor = o do polinômio (1 %)', () => {
        const delay = result.curves.group_delay_s ?? [];

        for (const index of indices.filter((i) => i > 0 && i < 360)) {
            const frequency = FREQUENCIES_HZ[index];
            const expected = reference.groupDelay(frequency);

            expect(
                Math.abs(delay[index] - expected),
                `${frequency.toFixed(1)} Hz`,
            ).toBeLessThan(0.01 * Math.abs(expected) + 2e-5);
        }
    });

    test('T7 — impedância do motor = a do polinômio (0,5 %)', () => {
        const impedance = result.curves.impedance_ohm ?? [];

        for (const index of indices) {
            const frequency = FREQUENCIES_HZ[index];
            const expected = abs(reference.impedance(frequency));

            expect(
                Math.abs(impedance[index] - expected) / expected,
                `${frequency.toFixed(1)} Hz`,
            ).toBeLessThan(0.005);
        }
    });

    test('T3 — 6ª ordem: o polinômio tem +24 dB/oitava embaixo e −12 dB/oitava em cima, e o motor o segue', () => {
        const analyticDb = (frequency: number) =>
            levelDb(reference.outflow(frequency), frequency, voltage);
        const slopeOf = (from: number) =>
            analyticDb(from * 2) - analyticDb(from);

        // Assíntotas do próprio polinômio, bem fora da grade do motor: quatro zeros na origem
        // (+4 × 6,02 = +24,08 dB/oitava) e seis polos contra eles (−2 × 6,02 = −12,04 dB/oitava).
        const perOctave = 20 * Math.log10(2);

        expect(Math.abs(slopeOf(0.001) - 4 * perOctave)).toBeLessThan(0.05);
        expect(Math.abs(slopeOf(1e6) + 2 * perOctave)).toBeLessThan(0.05);

        // Nas pontas da grade a inclinação do motor é a do polinômio.
        const spl = result.curves.spl_db ?? [];

        for (const [from, to] of [
            [0, 32],
            [320, 360],
        ]) {
            const octaves = Math.log2(
                FREQUENCIES_HZ[to] / FREQUENCIES_HZ[from],
            );
            const engineSlope = (spl[to] - spl[from]) / octaves;
            const analyticSlope =
                (analyticDb(FREQUENCIES_HZ[to]) -
                    analyticDb(FREQUENCIES_HZ[from])) /
                octaves;

            expect(Math.abs(engineSlope - analyticSlope)).toBeLessThan(0.02);
        }
    });

    test('a banda reproduzida fica entre as duas sintonias', () => {
        // Sintonias próximas (30 e 45 Hz): os dois cortes ficam entre elas (com folga de 10 %).
        const { f_low_hz: low, f_high_hz: high } = simulate(
            sixth({ fb_hz: 45, fb_rear_hz: 30 }),
        ).results;

        expect(low ?? 0).toBeGreaterThan(30 * 0.9);
        expect(high ?? 0).toBeLessThan(45 * 1.1);
        expect(low ?? 0).toBeLessThan(high ?? 0);
    });

    test('as bordas de −10 dB ficam fora das de −3 dB (specs/011)', () => {
        const { results } = simulate(sixth());

        expect(results.f_low10_hz ?? 0).toBeLessThan(results.f_low_hz ?? 0);
        expect(results.f_high10_hz ?? Infinity).toBeGreaterThan(
            results.f_high_hz ?? 0,
        );
    });

    test('sintonia da frontal maior desloca o corte superior para cima', () => {
        const at = (fb: number) =>
            simulate(sixth({ fb_hz: fb, fb_rear_hz: 30 })).results.f_high_hz;

        expect(at(60) ?? 0).toBeGreaterThan(at(45) ?? 0);
        expect(at(90) ?? 0).toBeGreaterThan(at(60) ?? 0);
    });
});

describe('bandpass 6ª ordem — bordas, volumes, comprimentos (T9, T10, T11)', () => {
    const driver: DriverInput = { ...REFERENCE, vd_m3: 0.002, xmax_m: 0.014 };

    test('T9 — as bordas do motor caem a −3,00 dB do pico da curva do polinômio', () => {
        const { results } = simulate(sixth());
        const reference = analytic(CASE);
        const voltage = Math.sqrt(3.6);
        const at = (frequency: number) =>
            levelDb(reference.outflow(frequency), frequency, voltage);

        expect(results.f_low_hz).toBeDefined();
        expect(results.f_high_hz).toBeDefined();
        expect(
            Math.abs(at(results.f_low_hz ?? 0) - ((results.peak_db ?? 0) - 3)),
        ).toBeLessThan(0.02);
        expect(
            Math.abs(at(results.f_high_hz ?? 0) - ((results.peak_db ?? 0) - 3)),
        ).toBeLessThan(0.02);
        expect(results.f_center_hz).toBeCloseTo(
            Math.sqrt((results.f_low_hz ?? 0) * (results.f_high_hz ?? 0)),
            9,
        );
        expect(results.bandwidth_oct).toBeCloseTo(
            Math.log2((results.f_high_hz ?? 1) / (results.f_low_hz ?? 1)),
            9,
        );
        expect(results.f3_hz).toBeUndefined();
        expect(results.qtc).toBeUndefined();
        expect(results.fc_hz).toBeUndefined();
    });

    test('T10 — volumes líquidos fecham a conta nas duas câmaras', () => {
        const result = simulate(
            sixth(
                {
                    port: { shape: 'round', diameter_m: 0.08, count: 2 },
                    port_rear: { shape: 'round', diameter_m: 0.1, count: 1 },
                },
                driver,
            ),
        );
        const frontArea = (Math.PI * 0.08 ** 2) / 4;
        const rearArea = (Math.PI * 0.1 ** 2) / 4;

        expect(
            (result.results.net_rear_m3 ?? 0) +
                0.002 +
                rearArea * (result.results.port_rear_length_m ?? 0),
        ).toBeCloseTo(0.08, 6);
        expect(
            (result.results.net_front_m3 ?? 0) +
                2 * frontArea * (result.results.port_length_m ?? 0),
        ).toBeCloseTo(0.04, 6);
        expect(result.results.net_volume_m3).toBeUndefined();
    });

    test.each([1, 3])(
        'T11 — comprimento de cada duto = c²·Sp/(4π²·F²·Vliq) − Δ da câmara dele (%i duto)',
        (count) => {
            const result = simulate(
                sixth(
                    {
                        port: { shape: 'round', diameter_m: 0.07, count },
                        port_rear: {
                            shape: 'rect',
                            width_m: 0.12,
                            height_m: 0.06,
                            count,
                        },
                    },
                    driver,
                ),
            );
            const expected = (
                tuning: number,
                net: number,
                area: number,
            ): number =>
                (SPEED_OF_SOUND ** 2 * count * area) /
                    (4 * Math.PI ** 2 * tuning ** 2 * net) -
                1.463 * Math.sqrt(area / Math.PI);
            const frontArea = (Math.PI * 0.07 ** 2) / 4;
            const rearArea = 0.12 * 0.06;
            const front = expected(
                70,
                result.results.net_front_m3 ?? 1,
                frontArea,
            );
            const rear = expected(
                30,
                result.results.net_rear_m3 ?? 1,
                rearArea,
            );

            expect(
                Math.abs((result.results.port_length_m ?? 0) - front) / front,
            ).toBeLessThan(1e-9);
            expect(
                Math.abs((result.results.port_rear_length_m ?? 0) - rear) /
                    rear,
            ).toBeLessThan(1e-9);
            expect(result.results.fb_hz).toBe(70);
            expect(result.results.fb_rear_hz).toBe(30);
        },
    );

    test('velocidade em cada duto: curvas separadas e máximos nos resultados', () => {
        const result = simulate(
            sixth(
                {
                    port: { shape: 'round', diameter_m: 0.08, count: 1 },
                    port_rear: { shape: 'round', diameter_m: 0.05, count: 1 },
                },
                driver,
                { signal: { mode: 'power', power_w: 200, radiation: 'half' } },
            ),
        );
        const front = result.curves.port_velocity_ms ?? [];
        const rear = result.curves.port_rear_velocity_ms ?? [];

        expect(front).toHaveLength(FREQUENCIES_HZ.length);
        expect(rear).toHaveLength(FREQUENCIES_HZ.length);
        expect(result.results.port_velocity_max_ms).toBe(Math.max(...front));
        expect(result.results.port_rear_velocity_max_ms).toBe(
            Math.max(...rear),
        );
        expect(front).not.toEqual(rear);
    });
});

describe('bandpass 6ª ordem — drivers, radiação, faltas, faixa e determinismo (T12–T16)', () => {
    const driver: DriverInput = { ...REFERENCE, vd_m3: 0.002, xmax_m: 0.014 };
    const voltage2v83: Partial<ProjectInput> = {
        signal: { mode: 'voltage', voltage_v: 2.83, radiation: 'half' },
    };

    test('T12 — 2 drivers em paralelo (caixa proporcional): Z/2 e +6,02 dB', () => {
        const one = simulate(sixth({}, driver, voltage2v83));
        const two = simulate(
            sixth({ vr_m3: 0.16, vf_m3: 0.08 }, driver, {
                ...voltage2v83,
                drivers: { count: 2, wiring: 'parallel' },
            }),
        );

        (one.curves.spl_db ?? []).forEach((value, index) => {
            expect(
                Math.abs((two.curves.spl_db?.[index] ?? 0) - value - 6.02),
            ).toBeLessThan(0.05);
            expect(two.curves.impedance_ohm?.[index]).toBeCloseTo(
                (one.curves.impedance_ohm?.[index] ?? 0) / 2,
                9,
            );
        });
    });

    test('T13 — meio espaço − espaço livre = 6,02 dB', () => {
        const half = simulate(sixth());
        const full = simulate(
            sixth({}, REFERENCE, {
                signal: { mode: 'power', power_w: 1, radiation: 'full' },
            }),
        );

        (half.curves.spl_db ?? []).forEach((value, index) => {
            expect(
                Math.abs(value - (full.curves.spl_db?.[index] ?? 0) - 6.02),
            ).toBeLessThan(0.01);
        });
    });

    test('T14 — entradas faltando: lista exata, com as chaves do duto traseiro à parte', () => {
        const empty = simulate(
            sixth(
                {
                    vr_m3: undefined,
                    vf_m3: undefined,
                    fb_hz: undefined,
                    fb_rear_hz: undefined,
                },
                {},
            ),
        );

        expect(empty.curves).toEqual({});
        expect(empty.missing.spl_db).toEqual([
            'fs_hz',
            'qts',
            'vas_m3',
            'vr_m3',
            'vf_m3',
            'fb_hz',
            'fb_rear_hz',
        ]);
        expect(empty.missing.excursion_m).toEqual([
            'fs_hz',
            'qts',
            'vas_m3',
            'vr_m3',
            'vf_m3',
            'fb_hz',
            'fb_rear_hz',
            're_ohm',
            'sd_m2',
            'qms',
        ]);

        const noPorts = simulate(sixth());

        expect(noPorts.missing.port_velocity_ms).toEqual(['diameter_m']);
        expect(noPorts.missing.port_rear_velocity_ms).toEqual([
            'rear_diameter_m',
        ]);
        expect(noPorts.curves.spl_db).toHaveLength(FREQUENCIES_HZ.length);
        expect(noPorts.curves.port_velocity_ms).toBeUndefined();
        expect(noPorts.curves.port_rear_velocity_ms).toBeUndefined();

        const noRear = simulate(
            sixth({
                port: { shape: 'round', diameter_m: 0.08, count: 1 },
                port_rear: undefined,
            }),
        );

        expect(noRear.missing.port_velocity_ms).toEqual([]);
        expect(noRear.missing.port_rear_velocity_ms).toEqual([
            'rear_diameter_m',
        ]);
        expect(noRear.curves.port_velocity_ms).toBeDefined();

        const rect = simulate(
            sixth({
                port_rear: { shape: 'rect', width_m: 0.1, count: 1 },
            }),
        );

        expect(rect.missing.port_rear_velocity_ms).toEqual(['rear_height_m']);
    });

    test('T14 — vb_m3 nunca é exigido, e os outros tipos não ganham faltas do duto traseiro', () => {
        expect(
            simulate(sixth({ vb_m3: undefined })).missing.spl_db,
        ).not.toContain('vb_m3');

        const vented = simulate({
            ...sixth(),
            box: {
                type: 'vented',
                ql: 7,
                vb_m3: 0.05,
                fb_hz: 40,
                port: { shape: 'round', diameter_m: 0.08, count: 1 },
            },
        });

        expect(vented.missing.port_rear_velocity_ms).toEqual([]);
        expect(vented.curves.port_rear_velocity_ms).toBeUndefined();
        expect(vented.results.fb_rear_hz).toBeUndefined();
    });

    test('T15 — corte fora da grade vem como "fora da faixa", nunca como número', () => {
        const below = simulate(
            sixth({ vr_m3: 5, vf_m3: 5, fb_hz: 8, fb_rear_hz: 5, ql: 7 }),
        ).results;

        expect(below.f_low_below_range).toBe(true);
        expect(below.f_low_hz).toBeUndefined();
        expect(below.f_center_hz).toBeUndefined();
        expect(below.bandwidth_oct).toBeUndefined();

        const high = simulate(
            sixth({
                vr_m3: 0.001,
                vf_m3: 0.0002,
                fb_hz: 800,
                fb_rear_hz: 700,
                ql: 7,
            }),
        ).results;

        expect(high.f_high_above_range).toBe(true);
        expect(high.f_high_hz).toBeUndefined();
        expect(high.f_center_hz).toBeUndefined();
        expect(high.bandwidth_oct).toBeUndefined();
    });

    test('T16 — determinismo: mesma entrada, mesma saída', () => {
        const input = sixth({}, driver);

        expect(simulate(input)).toEqual(simulate(input));
    });

    test('nada de NaN nem Infinity em entradas extremas, nem com as câmaras e sintonias iguais', () => {
        const inputs = [
            sixth({ vr_m3: 1e-4, vf_m3: 1e-4 }),
            sixth({ fb_hz: 5, fb_rear_hz: 500 }),
            sixth({ fb_hz: 500, fb_rear_hz: 5 }),
            // Simetria perfeita: as saídas dos dois dutos se cancelam por completo.
            sixth({ vr_m3: 0.05, vf_m3: 0.05, fb_hz: 40, fb_rear_hz: 40 }),
            sixth({
                port: { shape: 'round', diameter_m: 0.005, count: 8 },
                port_rear: { shape: 'round', diameter_m: 0.005, count: 8 },
            }),
        ];

        for (const input of inputs) {
            const { curves, results } = simulate(input);

            for (const values of Object.values(curves)) {
                expect(values?.every(Number.isFinite)).toBe(true);
            }

            for (const value of Object.values(results)) {
                if (typeof value === 'number') {
                    expect(Number.isFinite(value)).toBe(true);
                }
            }
        }
    });

    test('câmaras e sintonias iguais: o nível cai muito abaixo do de sintonias diferentes', () => {
        const equal = simulate(
            sixth({ vr_m3: 0.05, vf_m3: 0.05, fb_hz: 40, fb_rear_hz: 40 }),
        );
        const apart = simulate(
            sixth({ vr_m3: 0.05, vf_m3: 0.05, fb_hz: 60, fb_rear_hz: 30 }),
        );

        expect(Math.max(...(equal.curves.spl_db ?? []))).toBeLessThan(
            Math.max(...(apart.curves.spl_db ?? [])) - 60,
        );
    });
});

describe('bandpass 6ª ordem — avisos por câmara (T34)', () => {
    const round = (diameter_m: number) => ({
        shape: 'round' as const,
        diameter_m,
        count: 1,
    });

    // Ql finito (padrão 7): sem perdas, uma sintonia exatamente sobre um ponto da grade dá 0·∞.
    function warningsOf(box: Partial<BoxInput>, driver = REFERENCE) {
        const result = simulate(sixth({ ql: 7, ...box }, driver));

        for (const curve of Object.values(result.curves)) {
            expect(curve.every((value) => !Number.isNaN(value))).toBe(true);
        }

        return result.warnings.map(({ id, chamber }) => `${id}:${chamber}`);
    }

    test('drivers que não cabem na câmara traseira: rearVolumeInvalid na traseira', () => {
        expect(
            warningsOf(
                { vr_m3: 0.001, port_rear: round(0.05) },
                { ...REFERENCE, vd_m3: 0.002 },
            ),
        ).toContain('rearVolumeInvalid:rear');
    });

    test('duto que não cabe: portVolumeTooLarge só na câmara do duto', () => {
        expect(
            warningsOf({ vr_m3: 0.002, fb_rear_hz: 30, port_rear: round(0.1) }),
        ).toContain('portVolumeTooLarge:rear');
        expect(
            warningsOf({ vf_m3: 0.002, fb_hz: 30, port: round(0.1) }),
        ).toContain('portVolumeTooLarge:front');
        // Duto frontal que não cabe não acusa a traseira.
        expect(
            warningsOf({ vf_m3: 0.002, fb_hz: 30, port: round(0.1) }),
        ).not.toContain('portVolumeTooLarge:rear');
    });

    test('duto curto demais: portTooShort por duto', () => {
        expect(
            warningsOf({
                vr_m3: 0.2,
                fb_rear_hz: 100,
                port_rear: round(0.05),
            }),
        ).toContain('portTooShort:rear');
        expect(
            warningsOf({ vf_m3: 0.2, fb_hz: 100, port: round(0.05) }),
        ).toContain('portTooShort:front');
    });

    test('duto longo demais: portTooLong por duto, com o comprimento', () => {
        expect(
            warningsOf({
                vr_m3: 0.01,
                fb_rear_hz: 20,
                port_rear: round(0.02),
            }),
        ).toContain('portTooLong:rear');

        const long = simulate(
            sixth({ vf_m3: 0.01, fb_hz: 20, port: round(0.02) }),
        ).warnings.find(({ id }) => id === 'portTooLong');
        expect(long?.chamber).toBe('front');
        expect(long?.values?.length_m).toBeGreaterThan(0);
    });

    test('projeto sem problema não tem aviso de câmara', () => {
        const ids = warningsOf({
            fb_hz: 45,
            port: round(0.1),
            port_rear: round(0.1),
        });

        expect(
            ids.filter((id) => /rearVolume|portVolume|portToo/.test(id)),
        ).toEqual([]);
    });

    test('os tipos antigos não marcam a câmara nos avisos', () => {
        const old = simulate({
            ...sixth({ vf_m3: 0.002, fb_hz: 30, port: round(0.1) }),
            box: {
                type: 'bandpass',
                vr_m3: 0.04,
                vf_m3: 0.002,
                fb_hz: 30,
                ql: LOSSLESS,
                port: round(0.1),
            },
        });

        expect(old.warnings.length).toBeGreaterThan(0);
        expect(old.warnings.every(({ chamber }) => chamber === undefined)).toBe(
            true,
        );
    });
});

describe('bandpass 6ª ordem — desempenho (SC-004)', () => {
    // Completa, com os dois dutos medidos e Ql finito (todas as curvas e velocidades calculadas).
    const complete = sixth({
        ql: 7,
        fb_hz: 45,
        port: { shape: 'round', diameter_m: 0.1, count: 1 },
        port_rear: { shape: 'round', diameter_m: 0.08, count: 1 },
    });

    test('< 5 ms por projeto completo', () => {
        simulate(complete); // aquece

        const start = performance.now();

        for (let run = 0; run < 50; run += 1) {
            simulate(complete);
        }

        expect((performance.now() - start) / 50).toBeLessThan(5);
    });

    test('três projetos plotados atualizam em ≤ 100 ms', () => {
        const projects = [
            complete,
            sixth({ ...complete.box, fb_hz: 50 }),
            sixth({ ...complete.box, fb_rear_hz: 25 }),
        ];

        const start = performance.now();

        for (const project of projects) {
            simulate(project);
        }

        expect(performance.now() - start).toBeLessThan(100);
    });
});
