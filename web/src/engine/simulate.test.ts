import { describe, expect, test } from 'vite-plus/test';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { FREQUENCIES_HZ } from './frequencies';
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
            port: { shape: 'round', diameter_m: 0.1, count: 1 },
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
