import { describe, expect, test } from 'vite-plus/test';
import { bandEdges, rearLossReferenceHz, rearNetVolume } from './bandpass';
import { abs, add, arg, complex, div, mul, scale } from './complex';
import type { Complex } from './complex';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { FREQUENCIES_HZ } from './frequencies';
import { simulate } from './simulate';
import type { BoxInput, DriverInput, ProjectInput } from './types';

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

function bandpass(
    box: Partial<BoxInput> = {},
    driver: DriverInput = REFERENCE,
    extra: Partial<ProjectInput> = {},
): ProjectInput {
    return {
        name: 'bandpass',
        driver,
        drivers: { count: 1, wiring: 'parallel' },
        box: {
            type: 'bandpass',
            vr_m3: 0.04,
            vf_m3: 0.06,
            fb_hz: 45,
            ql: LOSSLESS,
            // Sem medidas: o duto não ocupa volume e só a sintonia conta.
            port: { shape: 'round', count: 1 },
            ...box,
        },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
        ...extra,
    };
}

describe('bandpass — funções puras', () => {
    test('volume líquido traseiro = Vr − volume dos drivers', () => {
        expect(rearNetVolume(0.04, 0.003)).toBeCloseTo(0.037, 12);
    });

    test('frequência de referência da perda traseira = Fs·√(1 + Vas/Vr)', () => {
        expect(rearLossReferenceHz(28, 0.085, 0.04)).toBeCloseTo(
            28 * Math.sqrt(1 + 0.085 / 0.04),
            9,
        );
    });

    // B8 — −3 dB exatos em 30 e 80 Hz: parábola em log f centrada em √(30·80).
    describe('bandEdges (B8, B13)', () => {
        const center = Math.sqrt(30 * 80);
        const span = Math.log(80 / center);
        const parabola = (frequency: number) =>
            -3 * (Math.log(frequency / center) / span) ** 2;

        test('acha os cortes de −3 dB, a frequência central e a largura', () => {
            const edges = bandEdges(parabola);

            expect(Math.abs((edges.f_low_hz ?? 0) - 30) / 30).toBeLessThan(
                5e-4,
            );
            expect(Math.abs((edges.f_high_hz ?? 0) - 80) / 80).toBeLessThan(
                5e-4,
            );
            expect(edges.peak_db).toBeCloseTo(0, 2);
            expect(edges.f_center_hz).toBeCloseTo(
                Math.sqrt((edges.f_low_hz ?? 0) * (edges.f_high_hz ?? 0)),
                9,
            );
            expect(edges.bandwidth_oct).toBeCloseTo(
                Math.log2((edges.f_high_hz ?? 0) / (edges.f_low_hz ?? 1)),
                9,
            );
            expect(edges.below_range).toBe(false);
            expect(edges.above_range).toBe(false);
        });

        test('com a queda de 10 dB acha as bordas de −10 dB; sem argumento segue em 3 dB', () => {
            // −3·(ln(f/c)/span)² = −10 → ln(f/c) = ±span·√(10/3).
            const wide = bandEdges(parabola, 10);
            const reach = span * Math.sqrt(10 / 3);

            expect(
                Math.abs((wide.f_low_hz ?? 0) - center * Math.exp(-reach)) /
                    (center * Math.exp(-reach)),
            ).toBeLessThan(5e-4);
            expect(
                Math.abs((wide.f_high_hz ?? 0) - center * Math.exp(reach)) /
                    (center * Math.exp(reach)),
            ).toBeLessThan(5e-4);
            expect(bandEdges(parabola)).toEqual(bandEdges(parabola, 3));
        });

        test('corte inferior fora da grade: indefinido, sem número inventado', () => {
            // Sem queda abaixo de 100 Hz; −20 dB/década acima.
            const edges = bandEdges((frequency) =>
                frequency <= 100 ? 0 : -20 * Math.log10(frequency / 100),
            );

            expect(edges.below_range).toBe(true);
            expect(edges.f_low_hz).toBeUndefined();
            expect(edges.f_center_hz).toBeUndefined();
            expect(edges.bandwidth_oct).toBeUndefined();
            expect(
                Math.abs((edges.f_high_hz ?? 0) - 100 * 10 ** (3 / 20)),
            ).toBeLessThan(0.1);
        });

        test('corte superior fora da grade: indefinido', () => {
            const edges = bandEdges((frequency) =>
                frequency >= 100 ? 0 : -20 * Math.log10(100 / frequency),
            );

            expect(edges.above_range).toBe(true);
            expect(edges.f_high_hz).toBeUndefined();
            expect(edges.f_low_hz).toBeDefined();
        });

        test('dois picos com vale de mais de 3 dB: valem os cortes mais externos', () => {
            const hump = (frequency: number, at: number) =>
                -12 * Math.log2(frequency / at) ** 2;
            const edges = bandEdges((frequency) =>
                Math.max(hump(frequency, 30), hump(frequency, 90)),
            );

            expect(
                Math.abs((edges.f_low_hz ?? 0) - 30 / Math.SQRT2),
            ).toBeLessThan(0.05);
            expect(
                Math.abs((edges.f_high_hz ?? 0) - 90 * Math.SQRT2),
            ).toBeLessThan(0.2);
        });
    });
});

// Função de transferência analítica da bandpass de 4ª ordem (research.md §3), avaliada com Horner
// e sem usar `solveCircuit`. Sem perdas e com Le = 0:
//   Up/V = Bl·Sd·s / P4(s)
//   P4(s) = (1 + a·s²)·(Re·Mms·s² + K·s + Re·(1/Cms + Sd²/Cr)) + Re·Sd²·Map·s²
//   a = Map·Cf, K = Re·Rms + Bl²
function analytic(vr: number, vf: number, fb: number, driver = REFERENCE) {
    const fs = driver.fs_hz as number;
    const re = driver.re_ohm as number;
    const sd = driver.sd_m2 as number;
    const omegaS = 2 * Math.PI * fs;
    const cms = (driver.vas_m3 as number) / (RHO_C2 * sd ** 2);
    const mms = 1 / (omegaS ** 2 * cms);
    const bl = Math.sqrt((omegaS * mms * re) / (driver.qes as number));
    const rms = (omegaS * mms) / (driver.qms as number);
    const cr = vr / RHO_C2;
    const cf = vf / RHO_C2;
    const map = 1 / ((2 * Math.PI * fb) ** 2 * cf);
    const a = map * cf;
    const k = re * rms + bl ** 2;

    const polynomial = (coefficients: number[], s: Complex): Complex =>
        coefficients.reduce(
            (sum, coefficient) => add(mul(sum, s), complex(coefficient)),
            complex(0),
        );

    // P4 expandido em potências de s (grau 4 → 0).
    const c0 = re * (1 / cms + sd ** 2 / cr);
    const p4 = (s: Complex) =>
        polynomial(
            [
                a * re * mms,
                a * k,
                re * mms + a * c0 + re * sd ** 2 * map,
                k,
                c0,
            ],
            s,
        );

    // Volume que sai pelo duto por volt, m³/s/V.
    const outflow = (frequency: number): Complex => {
        const s = complex(0, 2 * Math.PI * frequency);

        return div(scale(s, bl * sd), p4(s));
    };

    return {
        outflow,
        // Impedância elétrica: Z = Re + Bl²/Zmt, com Re·Zmt + Bl² = P4 / (s·(1 + a·s²)).
        impedance: (frequency: number): Complex => {
            const s = complex(0, 2 * Math.PI * frequency);
            const factor = mul(s, add(complex(1), scale(mul(s, s), a)));
            const mechanical = scale(
                add(div(p4(s), factor), complex(-(bl ** 2))),
                1 / re,
            );

            return add(complex(re), div(complex(bl ** 2), mechanical));
        },
        // Atraso de grupo de jω·Up por diferença central em ω (passo relativo pequeno).
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

const levelDb = (outflow: Complex, frequency: number, voltage: number) => {
    const omega = 2 * Math.PI * frequency;
    const pressure =
        (omega * AIR_DENSITY * abs(outflow) * voltage) / (2 * Math.PI);

    return 20 * Math.log10(pressure / 20e-6);
};

describe('bandpass — contra a função de transferência analítica (B1, B2, B3, B6)', () => {
    const result = simulate(bandpass());
    const reference = analytic(0.04, 0.06, 45);
    const voltage = Math.sqrt(1 * 3.6);
    // Frequências distribuídas da grade (inclui as bordas e a banda).
    const indices = [0, 20, 40, 60, 80, 100, 120, 140, 160, 200, 260, 340, 360];

    test('as curvas existem na grade inteira (o duto sem medidas não tem velocidade)', () => {
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
    });

    test('B1 — SPL do motor = SPL do polinômio (0,01 dB)', () => {
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

    test('B2 — atraso de grupo do motor = o do polinômio (1 %)', () => {
        const delay = result.curves.group_delay_s ?? [];

        // Fora das pontas da grade (diferença central ali é unilateral).
        for (const index of indices.filter((i) => i > 0 && i < 360)) {
            const frequency = FREQUENCIES_HZ[index];
            const expected = reference.groupDelay(frequency);

            expect(
                Math.abs(delay[index] - expected),
                `${frequency.toFixed(1)} Hz`,
            ).toBeLessThan(0.01 * Math.abs(expected) + 2e-5);
        }
    });

    test('B6 — impedância do motor = a do polinômio (0,5 %)', () => {
        const impedance = result.curves.impedance_ohm ?? [];

        for (const index of indices) {
            const frequency = FREQUENCIES_HZ[index];
            const expected = abs(reference.impedance(frequency));

            expect(
                Math.abs(impedance[index] - expected) / expected,
                `${frequency.toFixed(1)} Hz`,
            ).toBeLessThan(0.005);
        }

        // Bem acima de tudo a impedância volta para Re.
        expect(Math.abs(impedance[360] - 3.6) / 3.6).toBeLessThan(0.02);
    });

    test('B3 — 4ª ordem: o polinômio tem +12 dB/oitava embaixo e −12 dB/oitava em cima, e o motor o segue', () => {
        const slopeOf = (level: (frequency: number) => number, from: number) =>
            (level(from * 2) - level(from)) / 1;
        const analyticDb = (frequency: number) =>
            levelDb(reference.outflow(frequency), frequency, voltage);

        // Assíntotas do próprio polinômio, bem fora da grade do motor.
        expect(Math.abs(slopeOf(analyticDb, 0.001) - 12)).toBeLessThan(0.05);
        expect(Math.abs(slopeOf(analyticDb, 1e6) + 12)).toBeLessThan(0.05);

        // Na grade, a inclinação do motor é a do polinômio.
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
});

describe('bandpass — volumes, drivers, radiação e determinismo (B9–B14)', () => {
    const driver: DriverInput = { ...REFERENCE, vd_m3: 0.002, xmax_m: 0.014 };

    test('B9 — volumes líquidos fecham a conta', () => {
        const result = simulate(
            bandpass(
                {
                    port: { shape: 'round', diameter_m: 0.08, count: 1 },
                },
                driver,
            ),
        );
        const area = (Math.PI * 0.08 ** 2) / 4;

        expect((result.results.net_rear_m3 ?? 0) + 0.002).toBeCloseTo(0.04, 9);
        expect(
            (result.results.net_front_m3 ?? 0) +
                area * (result.results.port_length_m ?? 0),
        ).toBeCloseTo(0.06, 6);
        expect(result.results.net_volume_m3).toBeUndefined();
        expect(result.results.f3_hz).toBeUndefined();
        expect(result.results.qtc).toBeUndefined();
        expect(result.results.fc_hz).toBeUndefined();
    });

    test('B10 — 2 drivers em paralelo (caixa proporcional): Z/2 e +6,02 dB', () => {
        const one = simulate(
            bandpass({}, driver, {
                signal: { mode: 'voltage', voltage_v: 2.83, radiation: 'half' },
            }),
        );
        const two = simulate(
            bandpass({ vr_m3: 0.08, vf_m3: 0.12 }, driver, {
                drivers: { count: 2, wiring: 'parallel' },
                signal: { mode: 'voltage', voltage_v: 2.83, radiation: 'half' },
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

    test('B11 — meio espaço − espaço livre = 6,02 dB', () => {
        const half = simulate(bandpass());
        const full = simulate(
            bandpass({}, REFERENCE, {
                signal: { mode: 'power', power_w: 1, radiation: 'full' },
            }),
        );

        (half.curves.spl_db ?? []).forEach((value, index) => {
            expect(
                Math.abs(value - (full.curves.spl_db?.[index] ?? 0) - 6.02),
            ).toBeLessThan(0.01);
        });
    });

    test('B12 — entradas faltando: lista exata', () => {
        const empty = simulate(
            bandpass(
                { vr_m3: undefined, vf_m3: undefined, fb_hz: undefined },
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
        ]);
        expect(empty.missing.excursion_m).toEqual([
            'fs_hz',
            'qts',
            'vas_m3',
            'vr_m3',
            'vf_m3',
            'fb_hz',
            're_ohm',
            'sd_m2',
            'qms',
        ]);

        const noPort = simulate(bandpass());

        expect(noPort.missing.port_velocity_ms).toEqual(['diameter_m']);
        expect(noPort.curves.spl_db).toHaveLength(FREQUENCIES_HZ.length);
        expect(noPort.curves.port_velocity_ms).toBeUndefined();
    });

    test('B12 — vb_m3 nunca é exigido na bancada bandpass', () => {
        const result = simulate(bandpass({ vb_m3: undefined }));

        expect(result.missing.spl_db).not.toContain('vb_m3');
    });

    test('B13 — banda fora da grade vem como "fora da faixa", nunca como número', () => {
        const high = simulate(
            bandpass({ vr_m3: 0.001, vf_m3: 0.0002, fb_hz: 800, ql: 7 }),
        ).results;

        expect(high.f_high_above_range).toBe(true);
        expect(high.f_high_hz).toBeUndefined();
        expect(high.f_center_hz).toBeUndefined();
        expect(high.bandwidth_oct).toBeUndefined();
        expect(high.f_low_hz).toBeGreaterThan(900);

        const low = simulate(
            bandpass({ vr_m3: 5, vf_m3: 5, fb_hz: 8, ql: 7 }),
        ).results;

        expect(low.f_low_below_range).toBe(true);
        expect(low.f_low_hz).toBeUndefined();
        expect(low.f_high_hz).toBeDefined();
    });

    test('B8 — as bordas do motor caem a −3,00 dB do pico da curva do polinômio', () => {
        const { results } = simulate(bandpass());
        const reference = analytic(0.04, 0.06, 45);
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
    });

    test('B14 — determinismo: mesma entrada, mesma saída', () => {
        const input = bandpass({}, driver);

        expect(simulate(input)).toEqual(simulate(input));
    });
});

describe('bandpass — resposta relativa (sem dados elétricos)', () => {
    test('sem Re a curva sai relativa e as bordas continuam definidas e próximas das absolutas', () => {
        // Sem Re não há escala elétrica: a resposta sai relativa (Qms e Qts se derivam um do outro).
        const { re_ohm: _re, ...withoutRe } = REFERENCE;
        const relative = simulate(bandpass({}, withoutRe));
        const absolute = simulate(bandpass());

        expect(relative.spl_normalized).toBe(true);
        expect(absolute.spl_normalized).toBe(false);
        expect(relative.curves.spl_db).toBeDefined();
        expect(relative.curves.spl_db?.every(Number.isFinite)).toBe(true);

        const { f_low_hz: lowR, f_high_hz: highR } = relative.results;
        const { f_low_hz: low, f_high_hz: high } = absolute.results;

        expect(lowR).toBeDefined();
        expect(highR).toBeDefined();
        // Re só escala a parte elétrica: as bordas da banda ficam dentro de 10 Hz das absolutas.
        expect(lowR ?? 0).toBeCloseTo(low ?? 0, -1);
        expect(highR ?? 0).toBeCloseTo(high ?? 0, -1);
        expect((highR ?? 0) / (low ?? 1)).toBeGreaterThan(1.2);
    });
});

describe('bandpass — avisos (US3)', () => {
    const ids = (input: ProjectInput) =>
        simulate(input).warnings.map(({ id }) => id);

    test('câmara traseira menor que o volume dos drivers: aviso, sem curvas e sem NaN', () => {
        const result = simulate(
            bandpass({ vr_m3: 0.001 }, { ...REFERENCE, vd_m3: 0.002 }),
        );

        expect(result.warnings).toEqual([{ id: 'rearVolumeInvalid' }]);
        expect(result.results.net_rear_m3).toBeCloseTo(-0.001, 12);
        expect(result.curves).toEqual({});
    });

    test('duto que não cabe na câmara frontal', () => {
        const result = simulate(
            bandpass({
                vf_m3: 0.0005,
                fb_hz: 30,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            }),
        );

        expect(result.warnings.map(({ id }) => id)).toContain(
            'portVolumeTooLarge',
        );
        expect(result.curves).toEqual({});
    });

    test('duto curto demais (comprimento ≤ 0)', () => {
        expect(
            ids(
                bandpass({
                    fb_hz: 200,
                    port: { shape: 'round', diameter_m: 0.02, count: 1 },
                }),
            ),
        ).toContain('portTooShort');
    });

    test('duto mais longo que ∛Vf', () => {
        const result = simulate(
            bandpass({
                vf_m3: 0.05,
                fb_hz: 15,
                port: { shape: 'round', diameter_m: 0.05, count: 1 },
            }),
        );
        const warning = result.warnings.find(({ id }) => id === 'portTooLong');

        expect(warning?.values?.length_m).toBeGreaterThan(Math.cbrt(0.05));
    });

    test('câmara frontal zerada não lança nem produz NaN', () => {
        const result = simulate(bandpass({ vf_m3: 0 }));

        expect(result.curves).toEqual({});
        expect(result.warnings.map(({ id }) => id)).toContain(
            'portVolumeTooLarge',
        );
        expect(JSON.stringify(result)).not.toContain('null');
    });

    test('sem Le avisa; potência acima de N·Pe avisa', () => {
        const { le_h: _le, ...noLe } = REFERENCE;

        expect(ids(bandpass({}, noLe))).toContain('noInductance');
        expect(
            ids(
                bandpass(
                    {},
                    { ...REFERENCE, pe_w: 10 },
                    {
                        signal: {
                            mode: 'power',
                            power_w: 100,
                            radiation: 'half',
                        },
                    },
                ),
            ),
        ).toContain('aboveThermalPower');
    });

    test('velocidade máxima no duto sai nos resultados e a curva existe', () => {
        const result = simulate(
            bandpass(
                { port: { shape: 'round', diameter_m: 0.08, count: 1 } },
                { ...REFERENCE, xmax_m: 0.014 },
            ),
        );

        expect(result.results.port_velocity_max_ms).toBeGreaterThan(0);
        expect(result.curves.port_velocity_ms).toHaveLength(
            FREQUENCIES_HZ.length,
        );
        expect(result.results.xmax_power_w).toBeGreaterThan(0);
    });
});
