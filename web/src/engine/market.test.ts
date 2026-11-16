import { describe, expect, test } from 'vite-plus/test';
import { solveCircuit } from './circuit';
import { ANALYSIS_FREQUENCIES_HZ, FREQUENCIES_HZ } from './frequencies';
import { endCorrection, endFactor, END_FACTORS, portLength } from './port';
import { simulate } from './simulate';
import type { BoxInput, DriverInput, PortInput, ProjectInput } from './types';

// Casos publicados e padrões de mercado (reports/Compatibilidade do motor com o mercado.md): o motor
// contra números que ele não produziu. Tolerâncias: apertadas para fórmulas fechadas, largas para
// comprimentos de duto de ficha técnica (diâmetro interno real e volume bruto/líquido não informados).

const INCH = 0.0254;

function project(
    driver: DriverInput,
    box: Partial<BoxInput>,
    extra: Partial<ProjectInput> = {},
): ProjectInput {
    return {
        name: 'mercado',
        driver,
        drivers: { count: 1, wiring: 'parallel' },
        box: {
            type: 'closed',
            ql: 7,
            port: { shape: 'round', count: 1 },
            ...box,
        },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
        ...extra,
    };
}

const relative = (actual: number | undefined, expected: number) =>
    Math.abs((actual ?? Number.NaN) - expected) / Math.abs(expected);

const round = (diameter_m: number, extra: Partial<PortInput> = {}): PortInput =>
    ({ shape: 'round', diameter_m, count: 1, ...extra }) as PortInput;

// Comprimento para um volume líquido dado (como as fichas e as calculadoras informam).
const lengthFor = (
    net_m3: number,
    fb_hz: number,
    area_m2: number,
    count = 1,
    end_factor?: number,
) => portLength({ fb_hz, volume_m3: net_m3, area_m2, count, end_factor });

describe('correção de ponta', () => {
    test('presets: flangeada + livre (padrão), duas livres, duas flangeadas, slot na parede', () => {
        expect(endFactor(round(0.1))).toBe(1.463);
        expect(END_FACTORS).toEqual({
            flangedFree: 1.463,
            free: 1.226,
            flanged: 1.7,
            slotWall: 2.2,
        });
        expect(endFactor(round(0.1, { end: 'custom', end_k: 1.9 }))).toBe(1.9);
        // `custom` sem número fica no padrão.
        expect(endFactor(round(0.1, { end: 'custom' }))).toBe(1.463);
    });

    test('o padrão é o 0,732·D do WinISD, da AJ e da Omni: duto de 10 cm a 32 Hz em 50 L líquidos', () => {
        const area = (Math.PI * 0.1 ** 2) / 4;

        expect(endCorrection(area)).toBeCloseTo(0.7315 * 0.1, 4);
        // AJ/Omni (k 0,732, c 344,15) dão 38,70 cm; diyaudioandvideo B4 dá 38,40 cm.
        expect(Math.abs(lengthFor(0.05, 32, area) - 0.387)).toBeLessThan(0.005);
    });

    test('a ponta escolhida muda o comprimento de verdade (o WinISD ignora, segundo usuários)', () => {
        const result = (end: PortInput['end']) =>
            simulate(
                project(
                    { fs_hz: 30, qts: 0.4, vas_m3: 0.08 },
                    {
                        type: 'vented',
                        vb_m3: 0.05,
                        fb_hz: 32,
                        port: round(0.1, { end }),
                    },
                ),
            ).results.port_length_m as number;

        // Δ muda de 1,463·r para 1,226·r e 1,70·r: ±1,2 cm (o volume do duto realimenta um pouco).
        expect(result('free') - result('flangedFree')).toBeCloseTo(0.012, 2);
        expect(result('flangedFree') - result('flanged')).toBeCloseTo(0.012, 2);
    });

    test('slot na parede reproduz o boletim do JL 10W6v3 (35 × 276 mm, 21,2 L, 39 Hz → 772 mm)', () => {
        const area = 0.035 * 0.276;

        expect(
            relative(
                lengthFor(0.0212, 39, area, 1, END_FACTORS.slotWall),
                0.772,
            ),
        ).toBeLessThan(0.01);
        // Com a ponta de duto redondo o slot sai 5 % mais longo, como na pesquisa.
        expect(relative(lengthFor(0.0212, 39, area), 0.772)).toBeGreaterThan(
            0.04,
        );
    });
});

describe('fichas técnicas e blogs: comprimento do duto (±10 %)', () => {
    test.each([
        // Bomber SW12 "som interno": 61 L bruto, motor 3,36 L, 2 × 4", Fb 40 → 53 cm.
        {
            name: 'Bomber interno',
            vb: 0.061,
            vd: 0.00336,
            d: 4 * INCH,
            n: 2,
            fb: 40,
            length: 0.53,
        },
        // Bomber SW12 "som externo": 52 L bruto, 2 × 4", Fb 54 → 29 cm.
        {
            name: 'Bomber externo',
            vb: 0.052,
            vd: 0.00336,
            d: 4 * INCH,
            n: 2,
            fb: 54,
            length: 0.29,
        },
    ])(
        '$name (volume bruto: o motor desconta driver e duto)',
        ({ vb, vd, d, n, fb, length }) => {
            const result = simulate(
                project(
                    { fs_hz: 37, qts: 0.48, vas_m3: 0.0315, vd_m3: vd },
                    {
                        type: 'vented',
                        vb_m3: vb,
                        fb_hz: fb,
                        port: { shape: 'round', diameter_m: d, count: n },
                    },
                ),
            );

            expect(relative(result.results.port_length_m, length)).toBeLessThan(
                0.1,
            );
        },
    );

    test.each([
        // Triton SUB 8": 16 L, Fb 52,55, Ø 75 mm → 250 mm.
        {
            name: 'Triton SUB 8"',
            net: 0.016,
            fb: 52.55,
            d: 0.075,
            length: 0.25,
            tolerance: 0.1,
        },
        // Bandpass 4ª AudioJudgement: câmara frontal 11 L, 58 Hz, Ø 10 cm → 55,7 cm (Δ 1,595·r).
        {
            name: 'bandpass 4ª, frontal',
            net: 0.011,
            fb: 58,
            d: 0.1,
            length: 0.557,
            tolerance: 0.03,
        },
        // Bandpass 6ª AudioJudgement (JL 10W6v3): 24 L / 47 Hz → 371 mm; 70 L / 27 Hz → 388 mm.
        {
            name: 'bandpass 6ª, frontal',
            net: 0.024,
            fb: 47,
            d: 0.1,
            length: 0.371,
            tolerance: 0.03,
        },
        {
            name: 'bandpass 6ª, traseira',
            net: 0.07,
            fb: 27,
            d: 0.1,
            length: 0.388,
            tolerance: 0.03,
        },
    ])('$name', ({ net, fb, d, length, tolerance }) => {
        expect(
            relative(lengthFor(net, fb, (Math.PI * d ** 2) / 4), length),
        ).toBeLessThan(tolerance);
    });
});

describe('fórmulas fechadas contra fichas (tolerância apertada)', () => {
    test('JL 10W6v3 selada 15,6 L: Qtc 0,81, Fc 47,55 Hz, F3 42,27 Hz', () => {
        const { results } = simulate(
            project(
                { fs_hz: 30.12, qts: 0.513, vas_m3: 0.02325 },
                { vb_m3: 0.0156, ql: Number.POSITIVE_INFINITY },
            ),
        );

        expect(relative(results.qtc, 0.81)).toBeLessThan(0.005);
        expect(relative(results.fc_hz, 47.55)).toBeLessThan(0.005);
        expect(relative(results.f3_hz, 42.27)).toBeLessThan(0.005);
    });

    test.each([
        {
            name: 'Bomber SW12',
            driver: { fs_hz: 37, vas_m3: 0.0315, qes: 0.52, qts: 0.48 },
            spl: 87.02,
        },
        {
            name: 'Triton SUB 8"',
            driver: { fs_hz: 53.4, vas_m3: 0.00525, qes: 1.58, qts: 1.28 },
            spl: 79.08,
        },
    ])('SPL 1 W/1 m da ficha: $name', ({ driver, spl }) => {
        const { results } = simulate(project(driver, { vb_m3: 0.03 }));

        expect(Math.abs((results.spl0_db as number) - spl)).toBeLessThan(0.2);
    });

    test('tabela de alinhamento com QL 7: B4 dá F3/Fs 1,0 e F10/Fs 0,7598', () => {
        const fs = 30;
        const { results } = simulate(
            project(
                { fs_hz: fs, qts: 0.4048, vas_m3: 0.08 },
                { type: 'vented', vb_m3: 0.08 / 1.0613, fb_hz: fs },
            ),
        );

        expect(relative((results.f3_hz as number) / fs, 1)).toBeLessThan(0.01);
        expect(relative((results.f10_hz as number) / fs, 0.7598)).toBeLessThan(
            0.01,
        );
    });

    test('QL 10 do WinISD contra QL 7: F3 ~1 Hz mais baixo no 12" de 50 L', () => {
        const f3 = (ql: number) =>
            simulate(
                project(
                    { fs_hz: 30, qts: 0.4, vas_m3: 0.08 },
                    { type: 'vented', vb_m3: 0.05, fb_hz: 32, ql },
                ),
            ).results.f3_hz as number;

        expect(f3(7) - f3(10)).toBeGreaterThan(0.8);
        expect(f3(7) - f3(10)).toBeLessThan(1.6);
    });
});

describe('enchimento (QA)', () => {
    const driver: DriverInput = {
        fs_hz: 30,
        qes: 0.44,
        qms: 5,
        vas_m3: 0.08,
        re_ohm: 3.5,
        sd_m2: 0.05,
    };
    const run = (type: BoxInput['type'], fill?: BoxInput['fill']) =>
        simulate(
            project(driver, {
                type,
                vb_m3: 0.05,
                vr_m3: 0.04,
                vf_m3: 0.03,
                fb_hz: type === 'vented' ? 32 : 60,
                fb_rear_hz: 30,
                fill,
            }),
        );

    test('sem material é idêntico ao de antes', () => {
        for (const type of [
            'closed',
            'vented',
            'bandpass',
            'bandpass6',
        ] as const) {
            expect(run(type, 'none').curves).toEqual(run(type).curves);
        }
    });

    test('mais material: menos nível perto de Fb, F3 sobe, banda de passagem igual', () => {
        const none = run('vented');
        const lined = run('vented', 'lined');
        const stuffed = run('vented', 'stuffed');
        const at = (sim: typeof none, f: number) =>
            sim.curves.spl_db![FREQUENCIES_HZ.findIndex((x) => x >= f)];

        expect(at(lined, 35)).toBeLessThan(at(none, 35));
        expect(at(stuffed, 35)).toBeLessThan(at(lined, 35));
        // A pesquisa estima ~1,3 dB a menos e F3 ~3 Hz acima com a câmara preenchida (QA 10).
        expect(at(none, 45) - at(stuffed, 45)).toBeGreaterThan(0.3);
        expect(at(none, 45) - at(stuffed, 45)).toBeLessThan(2.5);
        const rise =
            (stuffed.results.f3_hz as number) - (none.results.f3_hz as number);
        expect(rise).toBeGreaterThan(0.5);
        expect(rise).toBeLessThan(5);
        // Rab é constante ([S73v]): em cima a caixa vira uma resistência Sd²·Rab que amortece um pouco.
        expect(Math.abs(at(stuffed, 500) - at(none, 500))).toBeLessThan(0.2);
    });

    test('absorção conserva o volume: sem vazamento, U_radiado − U_duto = U_cone', () => {
        const cab = 0.05 / (1.204 * 343.2 ** 2);
        const params = {
            re: 3.5,
            le: 0,
            bl: 13,
            mms: 0.12,
            cms: 2.3e-4,
            rms: 4,
            sd: 0.05,
            cab,
            ral: Number.POSITIVE_INFINITY,
            rab: 1 / (10 * 2 * Math.PI * 32 * cab),
            map: 1 / ((2 * Math.PI * 32) ** 2 * cab),
        };

        for (const f of [15, 32, 60, 200]) {
            const point = solveCircuit(params, f);
            const ud = [point.velocity.re * 0.05, point.velocity.im * 0.05];
            const error = Math.hypot(
                point.radiated.re - point.port.re - ud[0],
                point.radiated.im - point.port.im - ud[1],
            );

            expect(error).toBeLessThan(1e-9 * Math.hypot(ud[0], ud[1]));
        }
    });
});

describe('bobina com perdas (Leach, Le em 1 kHz e 10 kHz)', () => {
    // Bomber SW12: Le 2,65 mH em 1 kHz e 1,11 mH em 10 kHz → n = 1 − log10(2,65/1,11) = 0,622.
    const driver: DriverInput = {
        fs_hz: 37,
        qes: 0.52,
        qms: 8,
        vas_m3: 0.0315,
        re_ohm: 3.3,
        sd_m2: 0.0507,
        le_h: 0.00265,
    };
    const box = { type: 'vented' as const, vb_m3: 0.05, fb_hz: 35 };

    test('Le em 10 kHz igual ao de 1 kHz é o indutor simples (n = 1)', () => {
        const simple = simulate(project(driver, box));
        const same = simulate(project({ ...driver, le10k_h: 0.00265 }, box));

        same.curves.impedance_ohm!.forEach((value, index) => {
            expect(
                relative(value, simple.curves.impedance_ohm![index]),
            ).toBeLessThan(1e-9);
        });
    });

    test('a impedância em 10 kHz é Re + K·(jω)^n com K e n ajustados pelos dois pontos', () => {
        const { curves } = simulate(
            project({ ...driver, le10k_h: 0.00111 }, box),
        );
        const index = FREQUENCIES_HZ.findIndex((f) => f >= 10000);
        const f = FREQUENCIES_HZ[index];
        const n = 1 - Math.log10(2.65 / 1.11);
        const k =
            (0.00265 * (2 * Math.PI * 1000) ** (1 - n)) /
            Math.sin((n * Math.PI) / 2);
        const w = 2 * Math.PI * f;
        const expected = Math.hypot(
            3.3 + k * w ** n * Math.cos((n * Math.PI) / 2),
            k * w ** n * Math.sin((n * Math.PI) / 2),
        );
        // Indutância efetiva Im(Z)/ω em 10 kHz volta a 1,11 mH; o movimento do cone já não conta.
        expect((k * w ** n * Math.sin((n * Math.PI) / 2)) / w).toBeCloseTo(
            0.00111 * (10000 / f) ** (1 - n),
            8,
        );
        expect(relative(curves.impedance_ohm![index], expected)).toBeLessThan(
            0.002,
        );
    });

    test('tira a corcova do Le simples em 100–200 Hz e não muda o F3', () => {
        const simple = simulate(project(driver, box));
        const lossy = simulate(project({ ...driver, le10k_h: 0.00111 }, box));
        const at = (sim: typeof simple, f: number) =>
            sim.curves.spl_db![
                ANALYSIS_FREQUENCIES_HZ.findIndex((x) => x >= f)
            ];

        expect(at(simple, 200) - at(lossy, 200)).toBeGreaterThan(0.5);
        expect(lossy.results.f3_hz).toBe(simple.results.f3_hz);
    });
});
