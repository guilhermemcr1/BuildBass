import { describe, expect, test } from 'vite-plus/test';
import { suggestBox } from './alignments';
import { portLength } from './port';
import { simulate } from './simulate';
import type { BoxType, DriverInput, ProjectInput } from './types';

function project(
    driver: DriverInput,
    type: BoxType,
    extra: Partial<ProjectInput> = {},
): ProjectInput {
    return {
        name: '',
        driver,
        drivers: { count: 1, wiring: 'parallel' },
        box: { type, ql: 7, port: { shape: 'round', count: 1 } },
        signal: { mode: 'power', power_w: 1, radiation: 'half' },
        ...extra,
    };
}

function relative(actual: number | undefined, expected: number) {
    return Math.abs((actual ?? Number.NaN) - expected) / expected;
}

describe('suggestBox', () => {
    test('R11: selada Qts 0,4 → Butterworth (Qtc 0,707)', () => {
        const input = project({ fs_hz: 30, qts: 0.4, vas_m3: 0.08 }, 'closed');
        const suggestion = suggestBox(input);

        expect(suggestion.ok).toBe(true);

        if (!suggestion.ok) {
            return;
        }

        expect(suggestion.alignment).toBe('butterworth2');
        expect(
            relative(suggestion.vb_m3, 0.08 / ((0.707 / 0.4) ** 2 - 1)),
        ).toBeLessThan(0.005);

        const result = simulate({
            ...input,
            box: { ...input.box, vb_m3: suggestion.vb_m3, ql: Infinity },
        });
        expect(relative(result.results.qtc, 0.707)).toBeLessThan(0.005);
    });

    test('R12: dutada Qts 0,35 → Keele', () => {
        const suggestion = suggestBox(
            project({ fs_hz: 30, qts: 0.35, vas_m3: 0.08 }, 'vented'),
        );

        expect(suggestion).toMatchObject({ ok: true, alignment: 'keele' });

        if (!suggestion.ok) {
            return;
        }

        expect(
            relative(suggestion.vb_m3, 15 * 0.35 ** 2.87 * 0.08),
        ).toBeLessThan(0.005);
        expect(
            relative(suggestion.fb_hz, 0.42 * 30 * 0.35 ** -0.9),
        ).toBeLessThan(0.005);
    });

    test('Vb bruto soma o volume dos drivers e do duto, para N drivers', () => {
        const base = suggestBox(
            project({ fs_hz: 30, qts: 0.35, vas_m3: 0.08 }, 'vented'),
        );
        const input = project(
            { fs_hz: 30, qts: 0.35, vas_m3: 0.08, vd_m3: 0.002 },
            'vented',
            { drivers: { count: 2, wiring: 'parallel' } },
        );
        input.box.port = { shape: 'round', diameter_m: 0.1, count: 2 };
        const suggestion = suggestBox(input);

        if (!base.ok || !suggestion.ok || base.fb_hz === undefined) {
            throw new Error('sugestão esperada');
        }

        const area = (Math.PI * 0.1 ** 2) / 4;
        const net = 2 * base.vb_m3;
        const length = portLength({
            fb_hz: base.fb_hz,
            volume_m3: net,
            area_m2: area,
            count: 2,
        });
        expect(
            relative(suggestion.vb_m3, net + 2 * 0.002 + 2 * area * length),
        ).toBeLessThan(1e-9);

        // A simulação com o Vb sugerido volta ao volume líquido do alinhamento.
        const result = simulate({
            ...input,
            box: {
                ...input.box,
                vb_m3: suggestion.vb_m3,
                fb_hz: suggestion.fb_hz,
            },
        });
        expect(relative(result.results.net_volume_m3, net)).toBeLessThan(1e-6);
    });

    test('fora da faixa explica o motivo', () => {
        expect(
            suggestBox(
                project({ fs_hz: 30, qts: 0.7, vas_m3: 0.08 }, 'closed'),
            ),
        ).toEqual({ ok: false, reason: 'qtsTooHigh' });
        expect(
            suggestBox(
                project({ fs_hz: 30, qts: 0.55, vas_m3: 0.08 }, 'vented'),
            ),
        ).toEqual({ ok: false, reason: 'qtsTooHigh', recommend: 'closed' });
        expect(
            suggestBox(
                project({ fs_hz: 30, qts: 0.15, vas_m3: 0.08 }, 'vented'),
            ),
        ).toEqual({ ok: false, reason: 'qtsTooLow' });
    });

    test('sem Fs, Qts e Vas não sugere', () => {
        expect(suggestBox(project({ fs_hz: 30, qes: 0.4 }, 'closed'))).toEqual({
            ok: false,
            reason: 'missing',
            missing: ['qts', 'vas_m3'],
        });
    });
});
