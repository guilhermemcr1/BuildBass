import { describe, expect, test } from 'vite-plus/test';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { ANALYSIS_FREQUENCIES_HZ, FREQUENCIES_HZ } from './frequencies';
import { portLength } from './port';
import { signalLevels } from './simulate';
import { simulate } from './simulate';
import type { BoxInput, DriverInput, ProjectInput } from './types';

const LOSSLESS = Number.POSITIVE_INFINITY;

function project(
    driver: DriverInput,
    box: Partial<BoxInput>,
    extra: Partial<ProjectInput> = {},
): ProjectInput {
    return {
        name: 'teste',
        driver,
        drivers: { count: 1, wiring: 'parallel' },
        box: {
            type: 'closed',
            ql: LOSSLESS,
            // Sem medida: o duto não ocupa volume e só a sintonia (Fb) conta.
            port: { shape: 'round', count: 1 },
            ...box,
        },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
        ...extra,
    };
}

// Passa-altas de Butterworth em dB: |H|² = x^(2n) / (1 + x^(2n)), x = f/fc.
function butterworthDb(frequency: number, cutoff: number, order: number) {
    const x = (frequency / cutoff) ** (2 * order);

    return 10 * Math.log10(x / (1 + x));
}

// Driver de referência coerente (quickstart.md).
const REFERENCE: DriverInput = {
    fs_hz: 28,
    qes: 0.42,
    qms: 4.1,
    vas_m3: 0.085,
    re_ohm: 3.6,
    sd_m2: 0.0491,
};

describe('simulate — caixa selada (R1, R2)', () => {
    const fs = 30;
    const result = simulate(
        project({ fs_hz: fs, qts: 0.5, vas_m3: 0.05 }, { vb_m3: 0.05 }),
    );
    const fc = Math.SQRT2 * fs;

    test('Qtc = 0,707 e fc = √2·Fs', () => {
        expect(result.results.qtc).toBeCloseTo(Math.SQRT1_2, 6);
        expect(result.results.fc_hz).toBeCloseTo(fc, 6);
    });

    test('resposta igual ao Butterworth de 2ª ordem em fc (0,01 dB)', () => {
        const spl = result.curves.spl_db ?? [];

        FREQUENCIES_HZ.forEach((frequency, index) => {
            expect(
                Math.abs(spl[index] - butterworthDb(frequency, fc, 2)),
            ).toBeLessThan(0.01);
        });
    });

    test('F3 = fc (0,5 %)', () => {
        expect(Math.abs((result.results.f3_hz ?? 0) - fc) / fc).toBeLessThan(
            0.005,
        );
    });
});

describe('simulate — dutada B4 de Thiele (R3, R4)', () => {
    const fs = 30;
    const a1 = Math.sqrt(4 + 2 * Math.SQRT2);
    const vb = 0.05;
    const result = simulate(
        project(
            { fs_hz: fs, qts: 1 / a1, vas_m3: Math.SQRT2 * vb },
            { type: 'vented', vb_m3: vb, fb_hz: fs },
        ),
    );

    test('resposta igual ao Butterworth de 4ª ordem em Fs e F3 = Fs', () => {
        const spl = result.curves.spl_db ?? [];

        FREQUENCIES_HZ.forEach((frequency, index) => {
            expect(
                Math.abs(spl[index] - butterworthDb(frequency, fs, 4)),
            ).toBeLessThan(0.01);
        });
        expect(Math.abs((result.results.f3_hz ?? 0) - fs) / fs).toBeLessThan(
            0.005,
        );
    });

    test('atraso de grupo igual ao analítico do Butterworth de 4ª ordem (1 %)', () => {
        // Fase de H(s) = s⁴ / (s⁴ + a1·s³ + a2·s² + a1·s + 1) derivada numericamente.
        const a2 = 2 + Math.SQRT2;
        const phase = (frequency: number) => {
            const w = frequency / fs;
            const re = w ** 4 - a2 * w ** 2 + 1;
            const im = -a1 * w ** 3 + a1 * w;

            return -Math.atan2(im, re);
        };
        const delay = result.curves.group_delay_s ?? [];
        const expected = FREQUENCIES_HZ.map((frequency) => {
            const step = frequency * 1e-6;
            let delta = phase(frequency + step) - phase(frequency - step);
            delta -= 2 * Math.PI * Math.round(delta / (2 * Math.PI));

            return -delta / (2 * Math.PI * 2 * step);
        });
        const peak = Math.max(...expected);

        for (let index = 1; index < FREQUENCIES_HZ.length - 1; index++) {
            expect(Math.abs(delay[index] - expected[index])).toBeLessThan(
                0.01 * peak,
            );
        }
    });
});

describe('simulate — nível, eficiência e radiação (R13, R16)', () => {
    const half = simulate(project({ ...REFERENCE, le_h: 0 }, { vb_m3: 0.1 }));

    test('η0 = 4π²·Fs³·Vas / (c³·Qes) e SPL0 ≈ 112,1 + 10·log10 η0', () => {
        const eta0 =
            (4 * Math.PI ** 2 * 28 ** 3 * 0.085) / (SPEED_OF_SOUND ** 3 * 0.42);

        expect(half.results.efficiency).toBeCloseTo(eta0, 12);
        expect(
            Math.abs(
                (half.results.spl0_db ?? 0) - (112.1 + 10 * Math.log10(eta0)),
            ),
        ).toBeLessThan(0.1);
    });

    test('a 1 W, a banda de passagem chega ao SPL0 (0,05 dB)', () => {
        const spl = half.curves.spl_db ?? [];

        expect(half.spl_normalized).toBe(false);
        expect(
            Math.abs(spl[spl.length - 1] - (half.results.spl0_db ?? 0)),
        ).toBeLessThan(0.05);
    });

    test('meio espaço − espaço livre = 6,02 dB', () => {
        const full = simulate(
            project(
                { ...REFERENCE, le_h: 0 },
                { vb_m3: 0.1 },
                {
                    signal: { mode: 'power', power_w: 1, radiation: 'full' },
                },
            ),
        );
        const a = half.curves.spl_db ?? [];
        const b = full.curves.spl_db ?? [];

        a.forEach((value, index) => {
            expect(value - b[index]).toBeCloseTo(20 * Math.log10(2), 2);
        });
    });

    test('densidade e velocidade do som do ar a 20 °C', () => {
        expect(AIR_DENSITY).toBe(1.204);
        expect(SPEED_OF_SOUND).toBe(343.2);
    });
});

describe('simulate — dados faltando (R15)', () => {
    test('sem nada: nenhuma curva e a lista exata do que falta', () => {
        const result = simulate(project({}, {}));

        expect(result.curves).toEqual({});
        expect(result.missing.spl_db).toEqual([
            'fs_hz',
            'qts',
            'vas_m3',
            'vb_m3',
        ]);
        expect(result.missing.excursion_m).toEqual([
            'fs_hz',
            'qts',
            'vas_m3',
            'vb_m3',
            're_ohm',
            'sd_m2',
            'qms',
        ]);
        expect(result.missing.port_velocity_ms).toEqual([]);
    });

    test('só Fs, Qts e Vas: resposta normalizada, sem excursão nem impedância', () => {
        const result = simulate(
            project({ fs_hz: 28, qts: 0.38, vas_m3: 0.085 }, { vb_m3: 0.05 }),
        );

        expect(result.spl_normalized).toBe(true);
        expect(result.curves.spl_db).toHaveLength(FREQUENCIES_HZ.length);
        expect(result.curves.excursion_m).toBeUndefined();
        expect(result.missing.impedance_ohm).toEqual([
            're_ohm',
            'sd_m2',
            'qms',
        ]);
    });

    test('dutada sem Fb pede Fb', () => {
        const result = simulate(
            project(REFERENCE, { type: 'vented', vb_m3: 0.05 }),
        );

        expect(result.missing.spl_db).toEqual(['fb_hz']);
    });

    test('volume ocupado maior que a caixa invalida o volume líquido', () => {
        const result = simulate(
            project({ ...REFERENCE, vd_m3: 0.06 }, { vb_m3: 0.05 }),
        );

        expect(result.curves).toEqual({});
        expect(result.warnings).toContainEqual({ id: 'netVolumeInvalid' });
    });
});

describe('simulate — duto (US2)', () => {
    const vented = (port: BoxInput['port'], vb = 0.1, fb = 35) =>
        simulate(
            project(REFERENCE, { type: 'vented', vb_m3: vb, fb_hz: fb, port }),
        );

    test('comprimento consistente com o volume líquido e velocidade do ar', () => {
        const result = vented({ shape: 'round', diameter_m: 0.1, count: 1 });
        const area = (Math.PI * 0.1 ** 2) / 4;
        const net = result.results.net_volume_m3 ?? 0;
        const length = result.results.port_length_m ?? 0;

        expect(length).toBeGreaterThan(0);
        expect(
            portLength({ fb_hz: 35, volume_m3: net, area_m2: area, count: 1 }),
        ).toBeCloseTo(length, 9);
        expect(Math.abs(net + area * length - 0.1) / 0.1).toBeLessThan(1e-6);
        expect(result.curves.port_velocity_ms).toHaveLength(
            FREQUENCIES_HZ.length,
        );
        expect(result.results.port_velocity_max_ms).toBeGreaterThan(0);
        expect(result.warnings).toEqual([{ id: 'noInductance' }]);
    });

    test('a velocidade do ar é máxima perto de Fb', () => {
        const result = vented({ shape: 'round', diameter_m: 0.1, count: 1 });
        const velocity = result.curves.port_velocity_ms ?? [];
        const peak = velocity.indexOf(Math.max(...velocity));

        expect(Math.abs(FREQUENCIES_HZ[peak] - 35) / 35).toBeLessThan(0.1);
    });

    test('sem medida do duto: resposta sai, velocidade pede a medida', () => {
        const result = vented({ shape: 'rect', width_m: 0.05, count: 1 });

        expect(result.curves.spl_db).toBeDefined();
        expect(result.curves.port_velocity_ms).toBeUndefined();
        expect(result.missing.port_velocity_ms).toEqual(['height_m']);
    });

    test('duto curto demais avisa', () => {
        const result = vented(
            { shape: 'round', diameter_m: 0.02, count: 1 },
            0.1,
            35,
        );

        expect(result.warnings).toContainEqual({ id: 'portTooShort' });
    });

    test('duto longo demais avisa', () => {
        const result = vented(
            { shape: 'round', diameter_m: 0.1, count: 1 },
            0.1,
            20,
        );

        expect(result.warnings.map(({ id }) => id)).toContain('portTooLong');
    });

    test('duto que não cabe na caixa: sem curvas', () => {
        const result = vented(
            { shape: 'rect', width_m: 0.3, height_m: 0.3, count: 4 },
            0.05,
            40,
        );

        expect(result.curves).toEqual({});
        expect(result.warnings).toContainEqual({ id: 'portVolumeTooLarge' });
    });
});

describe('simulate — N drivers e sinal (R8, US5)', () => {
    const voltage = (
        count: number,
        wiring: 'series' | 'parallel',
        vb = 0.05,
    ): ProjectInput =>
        project(
            { ...REFERENCE, le_h: 0, xmax_m: 0.014, pe_w: 500 },
            { vb_m3: vb },
            {
                drivers: { count, wiring },
                signal: { mode: 'voltage', voltage_v: 2.83, radiation: 'half' },
            },
        );
    const one = simulate(voltage(1, 'parallel'));

    test('impedância: paralelo Z1/2, série 2·Z1 (caixa proporcional)', () => {
        const z1 = one.curves.impedance_ohm ?? [];
        const parallel = simulate(voltage(2, 'parallel', 0.1)).curves
            .impedance_ohm;
        const series = simulate(voltage(2, 'series', 0.1)).curves.impedance_ohm;

        z1.forEach((value, index) => {
            expect(parallel?.[index]).toBeCloseTo(value / 2, 9);
            expect(series?.[index]).toBeCloseTo(value * 2, 9);
        });
        expect(
            simulate(voltage(2, 'parallel', 0.1)).results.impedance_total_ohm,
        ).toBeCloseTo(1.8, 9);
    });

    test('2 em paralelo na mesma tensão: +6,02 dB em toda a curva', () => {
        const a = one.curves.spl_db ?? [];
        const b = simulate(voltage(2, 'parallel', 0.1)).curves.spl_db ?? [];

        a.forEach((value, index) => {
            expect(
                Math.abs(b[index] - value - 20 * Math.log10(2)),
            ).toBeLessThan(0.05);
        });
    });

    test('tensão do sinal = √(P·Re_tot) e potência equivalente', () => {
        const input = project(
            REFERENCE,
            { vb_m3: 0.1 },
            {
                drivers: { count: 2, wiring: 'series' },
                signal: { mode: 'power', power_w: 100, radiation: 'half' },
            },
        );

        expect(simulate(input).results.voltage_v).toBeCloseTo(
            Math.sqrt(100 * 7.2),
            9,
        );
        expect(signalLevels(input)).toEqual({
            re_total_ohm: 7.2,
            voltage_v: Math.sqrt(720),
            power_w: 100,
        });
        expect(
            signalLevels({
                ...input,
                signal: { mode: 'voltage', voltage_v: 12, radiation: 'half' },
            }).power_w,
        ).toBeCloseTo(144 / 7.2, 9);
    });

    test('potência no Xmax: menor P·(Xmax/x)² entre F3 e 1000 Hz', () => {
        const excursion = one.curves.excursion_m ?? [];
        const f3 = one.results.f3_hz ?? 0;
        const power = one.results.power_w ?? 0;
        const expected = Math.min(
            ...FREQUENCIES_HZ.flatMap((frequency, index) =>
                frequency >= f3
                    ? [power * (0.014 / excursion[index]) ** 2]
                    : [],
            ),
        );

        expect(one.results.xmax_power_w).toBeCloseTo(expected, 9);
    });

    test('acima de N·Pe avisa', () => {
        const input = project(
            { ...REFERENCE, pe_w: 500 },
            { vb_m3: 0.1 },
            {
                drivers: { count: 2, wiring: 'parallel' },
                signal: { mode: 'power', power_w: 1200, radiation: 'half' },
            },
        );

        expect(simulate(input).warnings).toContainEqual({
            id: 'aboveThermalPower',
            values: { power_w: 1200, limit_w: 1000 },
        });
        expect(
            simulate({
                ...input,
                signal: { ...input.signal, power_w: 900 },
            }).warnings.map(({ id }) => id),
        ).not.toContain('aboveThermalPower');
    });
});

test('desempenho: < 5 ms por projeto completo', () => {
    const input = project(
        { ...REFERENCE, le_h: 0.002 },
        { type: 'vented', vb_m3: 0.06, fb_hz: 32, ql: 7 },
    );
    simulate(input);
    const start = performance.now();

    for (let run = 0; run < 50; run++) {
        simulate(input);
    }

    expect((performance.now() - start) / 50).toBeLessThan(5);
});

// Regressão da feature 004: valores gravados antes da bandpass existir. Selada e dutada têm de
// continuar saindo bit a bit iguais (a bandpass não pode mexer no caminho delas).
describe('simulate — selada e dutada não mudaram com a bandpass (004, T013)', () => {
    const driver: DriverInput = {
        fs_hz: 28,
        qes: 0.42,
        qms: 4.1,
        vas_m3: 0.085,
        re_ohm: 3.6,
        sd_m2: 0.0491,
        le_h: 0.002,
        xmax_m: 0.014,
        vd_m3: 0.002,
    };
    const base = {
        name: 'x',
        driver,
        drivers: { count: 1, wiring: 'parallel' as const },
        signal: {
            mode: 'power' as const,
            power_w: 100,
            radiation: 'half' as const,
        },
    };
    const INDICES = [20, 60, 120, 200, 300];
    const sample = (values: number[] | undefined) =>
        INDICES.map((index) => (values ?? [])[index]);
    const BASELINE = {
        closed: {
            spl: [
                84.65245747009298, 93.15865741434112, 103.97044244720959,
                109.3035911911155, 103.59422712624819,
            ],
            imp: [
                4.548538679379665, 5.592134216297424, 25.344098097784247,
                3.7734931549280977, 6.420167125793529,
            ],
            exc: [
                0.00877476366572862, 0.007811459252637687, 0.005639868456212919,
                0.0013341075226426882, 5.3466265223254545e-5,
            ],
            gd: [
                0.007344596907032733, 0.005996006319453449,
                0.0045620536795228156, 0.0015737195902196404,
                0.00020196107648650023,
            ],
            results: {
                voltage_v: 18.973665961010276,
                power_w: 100,
                impedance_total_ohm: 3.6,
                efficiency: 0.004338720047560387,
                spl0_db: 88.53295534941672,
                net_volume_m3: 0.048,
                qtc: 0.6341615608418979,
                fc_hz: 46.60829682935575,
                f3_hz: 55.86457305357066,
                f10_hz: 29.977113381595476,
                xmax_power_w: 854.4407726932226,
            },
        },
        vented: {
            spl: [
                78.09857048106065, 95.36432388840285, 109.15914283990577,
                109.6426186686709, 103.61401681967413,
            ],
            imp: [
                8.446888766088353, 13.240250727738614, 20.36558571158137,
                3.7523556097491118, 6.421159480840231,
            ],
            exc: [
                0.01889061380502476, 0.011782116276770102, 0.00541641702206416,
                0.0013012504903312672, 5.333064060406216e-5,
            ],
            gd: [
                0.013579472032474478, 0.015758058298118636,
                0.008035337166619643, 0.0014946062494746667,
                0.00020019099292317504,
            ],
            pv: [
                11.421516528128281, 17.961589897389334, 8.791960410841023,
                0.43144573675096465, 0.0046433286410526315,
            ],
            results: {
                voltage_v: 18.973665961010276,
                power_w: 100,
                impedance_total_ohm: 3.6,
                efficiency: 0.004338720047560387,
                spl0_db: 88.53295534941672,
                fb_hz: 32,
                port_length_m: 0.2270953787113878,
                net_volume_m3: 0.07621639706644028,
                port_velocity_max_ms: 22.06272756469322,
                f3_hz: 29.902528867274228,
                f10_hz: 23.778682656048492,
                xmax_power_w: 664.3582855081249,
            },
        },
    };

    function close(actual: number[], expected: number[]) {
        actual.forEach((value, index) => {
            expect(Math.abs(value - expected[index])).toBeLessThanOrEqual(
                1e-9 * Math.abs(expected[index]),
            );
        });
    }

    test('selada', () => {
        const result = simulate({
            ...base,
            box: {
                type: 'closed',
                vb_m3: 0.05,
                ql: 7,
                port: { shape: 'round', count: 1 },
            },
        });

        close(sample(result.curves.spl_db), BASELINE.closed.spl);
        close(sample(result.curves.impedance_ohm), BASELINE.closed.imp);
        close(sample(result.curves.excursion_m), BASELINE.closed.exc);
        close(sample(result.curves.group_delay_s), BASELINE.closed.gd);
        expect(result.results).toEqual(BASELINE.closed.results);
    });

    test('dutada', () => {
        const result = simulate({
            ...base,
            box: {
                type: 'vented',
                vb_m3: 0.08,
                fb_hz: 32,
                ql: 7,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            },
        });

        close(sample(result.curves.spl_db), BASELINE.vented.spl);
        close(sample(result.curves.impedance_ohm), BASELINE.vented.imp);
        close(sample(result.curves.excursion_m), BASELINE.vented.exc);
        close(sample(result.curves.group_delay_s), BASELINE.vented.gd);
        close(sample(result.curves.port_velocity_ms), BASELINE.vented.pv);
        expect(result.results).toEqual(BASELINE.vented.results);
    });
});

describe('simulate — curvas até 20 kHz, resultados na grade de análise', () => {
    const ported = project(
        { ...REFERENCE, xmax_m: 0.012 },
        {
            type: 'vented',
            vb_m3: 0.08,
            fb_hz: 32,
            port: { shape: 'round', count: 1, diameter_m: 0.1 },
        },
        { signal: { mode: 'power', power_w: 100, radiation: 'half' } },
    );

    test('as curvas vão de 10 Hz a 20 kHz e têm um ponto por frequência', () => {
        const result = simulate(ported);

        expect(result.frequencies_hz.at(-1)).toBe(20000);
        expect(result.frequencies_hz).toHaveLength(FREQUENCIES_HZ.length);
        expect(result.curves.spl_db).toHaveLength(FREQUENCIES_HZ.length);
        expect(result.curves.group_delay_s).toHaveLength(FREQUENCIES_HZ.length);
        expect(result.curves.port_velocity_ms).toHaveLength(
            FREQUENCIES_HZ.length,
        );
    });

    test('a velocidade máxima no duto só olha a grade de análise', () => {
        const result = simulate(ported);
        const analysis = result.curves.port_velocity_ms?.slice(
            0,
            ANALYSIS_FREQUENCIES_HZ.length,
        );

        expect(result.results.port_velocity_max_ms).toBe(
            Math.max(...(analysis ?? [])),
        );
    });

    test('o F3 da selada não vê a queda de agudos acima de 1 kHz', () => {
        const result = simulate(
            project({ ...REFERENCE, le_h: 0.002 }, { vb_m3: 0.05 }),
        );

        expect(result.results.f3_hz).toBeGreaterThan(30);
        expect(result.results.f3_hz).toBeLessThan(150);
    });
});

// F-10 (specs/011): mesma busca do F3, com a queda de 10 dB sob a banda de passagem.
describe('simulate — F-10 (specs/011)', () => {
    test('selada Butterworth: F-10 = fc·(1/9)^(1/4) = 0,5774·fc (0,5 %)', () => {
        // |H|² = x⁴/(1 + x⁴) = 0,1 → x⁴ = 1/9.
        const fs = 30;
        const fc = Math.SQRT2 * fs;
        const { results } = simulate(
            project({ fs_hz: fs, qts: 0.5, vas_m3: 0.05 }, { vb_m3: 0.05 }),
        );
        const expected = fc * (1 / 9) ** (1 / 4);

        expect(
            Math.abs((results.f10_hz ?? 0) - expected) / expected,
        ).toBeLessThan(0.005);
        expect(results.f10_hz ?? 0).toBeLessThan(results.f3_hz ?? 0);
    });

    test('dutada B4: F-10 = Fs·(1/9)^(1/8) (0,5 %)', () => {
        // |H|² = x⁸/(1 + x⁸) = 0,1 → x⁸ = 1/9.
        const fs = 30;
        const a1 = Math.sqrt(4 + 2 * Math.SQRT2);
        const { results } = simulate(
            project(
                { fs_hz: fs, qts: 1 / a1, vas_m3: Math.SQRT2 * 0.05 },
                { type: 'vented', vb_m3: 0.05, fb_hz: fs },
            ),
        );
        const expected = fs * (1 / 9) ** (1 / 8);

        expect(
            Math.abs((results.f10_hz ?? 0) - expected) / expected,
        ).toBeLessThan(0.005);
    });

    test('corte abaixo da grade: sem número inventado', () => {
        const { results } = simulate(
            project({ fs_hz: 4, qts: 0.5, vas_m3: 0.05 }, { vb_m3: 0.05 }),
        );

        expect(results.f10_below_range).toBe(true);
        expect(results.f10_hz).toBeUndefined();
    });

    test('bandpass: as bordas de −10 dB ficam fora das de −3 dB', () => {
        const { results } = simulate(
            project(REFERENCE, {
                type: 'bandpass',
                vr_m3: 0.04,
                vf_m3: 0.06,
                fb_hz: 45,
            }),
        );

        expect(results.f_low10_hz ?? 0).toBeLessThan(results.f_low_hz ?? 0);
        expect(results.f_high10_hz ?? Infinity).toBeGreaterThan(
            results.f_high_hz ?? 0,
        );
    });
});
