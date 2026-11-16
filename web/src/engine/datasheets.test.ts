import { describe, expect, test } from 'vite-plus/test';
import { deriveDriver } from './driver';
import { simulate } from './simulate';
import type { DriverInput, ProjectInput } from './types';

// Referência independente do motor: os dois drivers do catálogo (valores em SI, transcritos das
// fichas técnicas públicas do fabricante, as mesmas do seeder em api/database/seeders) com a caixa
// dutada sugerida na própria ficha. Não substitui os casos R1–R16: confere o motor contra números
// que ele não produziu.
//
// A ficha não informa o Ql de projeto, e o F3 depende dele; por isso o F3 da ficha é comparado com
// o intervalo que o motor dá para Ql entre 7 (caixa com perdas) e 100 (quase sem perdas).

type Datasheet = {
    name: string;
    driver: DriverInput;
    vb_m3: number;
    fb_hz: number;
    port: { width_m: number; height_m: number };
    spl1w_db: number;
    efficiency: number;
    f3_hz: number;
};

const TR620: Datasheet = {
    name: 'Triton TR 620 12" (ficha de jul/2018)',
    driver: {
        fs_hz: 76.94,
        qts: 0.717,
        qes: 0.779,
        qms: 8.978,
        vas_m3: 0.026348,
        re_ohm: 3,
        le_h: 0.000607,
        xmax_m: 0.00635,
        sd_m2: 0.05309,
        pe_w: 620,
        bl_tm: 10.9,
        mms_kg: 0.06392,
        vd_m3: 0.000333,
    },
    vb_m3: 0.038,
    fb_hz: 78.17,
    port: { width_m: 0.08, height_m: 0.2 },
    spl1w_db: 93.89,
    efficiency: 0.0147,
    f3_hz: 64.07,
};

const TR1250: Datasheet = {
    name: 'Triton TR 1250 12" (ficha de mar/2018)',
    driver: {
        fs_hz: 64.46,
        qts: 0.42,
        qes: 0.44,
        qms: 9.88,
        vas_m3: 0.022,
        re_ohm: 2.8,
        le_h: 0.00112,
        xmax_m: 0.01075,
        sd_m2: 0.04888,
        pe_w: 1250,
        bl_tm: 15.36,
        mms_kg: 0.09295,
        vd_m3: 0.000526,
    },
    vb_m3: 0.033,
    fb_hz: 92.35,
    port: { width_m: 0.11, height_m: 0.21 },
    spl1w_db: 93.23,
    efficiency: 0.0127,
    f3_hz: 73.75,
};

function simulateBox(sheet: Datasheet, ql: number) {
    const project: ProjectInput = {
        name: sheet.name,
        driver: sheet.driver,
        drivers: { count: 1, wiring: 'parallel' },
        box: {
            type: 'vented',
            vb_m3: sheet.vb_m3,
            ql,
            fb_hz: sheet.fb_hz,
            port: { shape: 'rect', ...sheet.port, count: 1 },
        },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
    };

    return simulate(project).results;
}

describe.each([TR620, TR1250])('$name', (sheet) => {
    test('os parâmetros da ficha são consistentes entre si', () => {
        const { consistency } = deriveDriver(sheet.driver);

        for (const [key, entry] of Object.entries(consistency)) {
            expect(['ok', 'none', 'derived'], key).toContain(entry.status);
        }
    });

    test('SPL a 1 W fica a até 0,3 dB da ficha', () => {
        const { spl0_db } = simulateBox(sheet, 7);

        expect(spl0_db).toBeDefined();
        expect(Math.abs((spl0_db ?? 0) - sheet.spl1w_db)).toBeLessThan(0.3);
    });

    test('eficiência de referência fica a até 5 % da ficha', () => {
        const { efficiency } = simulateBox(sheet, 7);

        expect(efficiency).toBeDefined();
        expect(
            Math.abs((efficiency ?? 0) - sheet.efficiency) / sheet.efficiency,
        ).toBeLessThan(0.05);
    });

    test('o F3 da ficha cai dentro do intervalo do motor para Ql de 7 a 100 (± 1 Hz)', () => {
        const lossy = simulateBox(sheet, 7).f3_hz;
        const tight = simulateBox(sheet, 100).f3_hz;

        expect(lossy).toBeDefined();
        expect(tight).toBeDefined();
        const low = Math.min(lossy ?? 0, tight ?? 0) - 1;
        const high = Math.max(lossy ?? 0, tight ?? 0) + 1;

        expect(sheet.f3_hz).toBeGreaterThanOrEqual(low);
        expect(sheet.f3_hz).toBeLessThanOrEqual(high);
    });
});
