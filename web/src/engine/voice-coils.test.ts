import { describe, expect, test } from 'vite-plus/test';
import { signalLevels, simulate } from './simulate';
import type { ProjectInput } from './types';
import { withVoiceCoils } from './voice-coils';

// Bicho Papão 12" 800W 4+4 Ω (ficha da Bomber, bobinas em série).
const DVC: ProjectInput = {
    name: 'dvc',
    driver: {
        fs_hz: 37,
        qes: 0.52,
        qms: 11.17,
        vas_m3: 0.0315,
        re_ohm: 7.26,
        le_h: 0.00472,
        bl_tm: 21.7,
        sd_m2: 0.0453,
    },
    drivers: { count: 1, wiring: 'parallel', voice_coils: 2 },
    box: {
        type: 'closed',
        vb_m3: 0.04,
        ql: Number.POSITIVE_INFINITY,
        port: { shape: 'round', count: 1 },
    },
    signal: { mode: 'voltage', voltage_v: 10, radiation: 'half' },
};

function wired(coil_wiring: 'series' | 'parallel', voice_coils = 2) {
    return { ...DVC, drivers: { ...DVC.drivers, voice_coils, coil_wiring } };
}

describe('bobina dupla', () => {
    test('em paralelo: Re e Le a 1/4, BL à metade, o resto igual', () => {
        const { driver } = withVoiceCoils(wired('parallel'));

        expect(driver.re_ohm).toBeCloseTo(7.26 / 4, 10);
        expect(driver.le_h).toBeCloseTo(0.00472 / 4, 10);
        expect(driver.bl_tm).toBeCloseTo(21.7 / 2, 10);
        expect(driver.qes).toBe(0.52);
        expect(driver.fs_hz).toBe(37);
    });

    test('em série (ou sem dizer) e com bobina simples, nada muda', () => {
        expect(withVoiceCoils(wired('series')).driver).toBe(DVC.driver);
        expect(withVoiceCoils(DVC).driver).toBe(DVC.driver);
        expect(withVoiceCoils(wired('parallel', 1)).driver).toBe(DVC.driver);
    });

    test('paralelo dá 1/4 da carga e +6 dB com a mesma tensão', () => {
        const series = simulate(wired('series'));
        const parallel = simulate(wired('parallel'));

        expect(parallel.results.impedance_total_ohm).toBeCloseTo(
            (series.results.impedance_total_ohm ?? 0) / 4,
            10,
        );
        expect(signalLevels(wired('parallel')).power_w).toBeCloseTo(
            (signalLevels(wired('series')).power_w ?? 0) * 4,
            10,
        );

        const a = series.curves.spl_db ?? [];
        const b = parallel.curves.spl_db ?? [];
        const i = a.length - 1;
        expect(b[i] - a[i]).toBeCloseTo(20 * Math.log10(2), 1);
    });

    test('com a mesma potência, a resposta é a mesma nas duas ligações', () => {
        const power = {
            mode: 'power' as const,
            power_w: 100,
            radiation: 'half' as const,
        };
        const a =
            simulate({ ...wired('series'), signal: power }).curves.spl_db ?? [];
        const b =
            simulate({ ...wired('parallel'), signal: power }).curves.spl_db ??
            [];

        a.forEach((value, index) => expect(b[index]).toBeCloseTo(value, 6));
    });
});
