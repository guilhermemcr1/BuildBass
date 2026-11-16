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

    test('R12: dutada pela família de Thiele no QL da caixa (linha B4 publicada com QL 7)', () => {
        // Tabela de alinhamentos com QL 7: B4 em Qts 0,4048, Vas/Vb 1,0613, Fb/Fs 1,0, F3/Fs 1,0.
        const input = project(
            { fs_hz: 30, qts: 0.4048, vas_m3: 0.08 },
            'vented',
        );
        const suggestion = suggestBox(input);

        if (!suggestion.ok) {
            throw new Error('sugestão esperada');
        }

        expect(suggestion.alignment).toBe('b4');
        expect(suggestion.ql).toBe(7);
        expect(relative(0.08 / suggestion.vb_m3, 1.0613)).toBeLessThan(0.002);
        expect(relative(suggestion.fb_hz, 30)).toBeLessThan(0.002);

        const result = simulate({
            ...input,
            box: {
                ...input.box,
                vb_m3: suggestion.vb_m3,
                fb_hz: suggestion.fb_hz,
            },
        });
        expect(relative(result.results.f3_hz, 30)).toBeLessThan(0.005);
    });

    test('sem perdas cai na B4 de Thiele: Qts 0,3827, α = √2, h = 1', () => {
        const input = project(
            { fs_hz: 30, qts: 0.3827, vas_m3: 0.08 },
            'vented',
        );
        input.box.ql = Infinity;
        const suggestion = suggestBox(input);

        if (!suggestion.ok) {
            throw new Error('sugestão esperada');
        }

        expect(relative(0.08 / suggestion.vb_m3, Math.SQRT2)).toBeLessThan(
            0.002,
        );
        expect(relative(suggestion.fb_hz, 30)).toBeLessThan(0.002);
    });

    test('abaixo da B4 é QB3, acima é C4, e o QL muda a sugestão', () => {
        const at = (qts: number, ql = 7) => {
            const input = project({ fs_hz: 30, qts, vas_m3: 0.08 }, 'vented');
            input.box.ql = ql;
            return suggestBox(input);
        };
        const qb3 = at(0.35);
        const c4 = at(0.45);

        expect(qb3).toMatchObject({ ok: true, alignment: 'qb3' });
        expect(c4).toMatchObject({ ok: true, alignment: 'c4' });

        // QL 10 (padrão do WinISD) pede caixa um pouco menor que QL 7 para o mesmo driver: com menos
        // perdas a B4 vai para α = √2 (sem perdas), contra 1,061 com QL 7.
        const ql7 = at(0.4, 7);
        const ql10 = at(0.4, 10);
        if (!ql7.ok || !ql10.ok) {
            throw new Error('sugestão esperada');
        }
        expect(ql10.vb_m3).toBeLessThan(ql7.vb_m3);

        // Keele vem junto, como referência: 15·Qts^2,87·Vas e 0,42·Fs·Qts^-0,9.
        expect(
            relative(ql7.keele?.vb_m3, 15 * 0.4 ** 2.87 * 0.08),
        ).toBeLessThan(1e-9);
        expect(
            relative(ql7.keele?.fb_hz, 0.42 * 30 * 0.4 ** -0.9),
        ).toBeLessThan(1e-9);
    });

    test('C4 com ondulação acima de 1 dB recusa e recomenda a selada', () => {
        const input = project({ fs_hz: 30, qts: 0.49, vas_m3: 0.08 }, 'vented');

        expect(suggestBox(input)).toEqual({
            ok: false,
            reason: 'qtsTooHigh',
            recommend: 'closed',
        });
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

    test('duto que ocuparia mais que o ar da caixa: recusa e diz a área máxima', () => {
        // Driver pequeno (Vas 8 L): QB3 com V_líq ≈ 1,7 L e Fb ≈ 47 Hz.
        const driver = { fs_hz: 30, qts: 0.25, vas_m3: 0.008 };
        const base = suggestBox(project(driver, 'vented'));

        if (!base.ok || base.fb_hz === undefined) {
            throw new Error('sugestão esperada');
        }

        const net = base.vb_m3;
        const fb = base.fb_hz;
        const maxArea = (2 * Math.PI * fb * net) / 343.2;
        const withPort = (diameter_m: number, count = 1) => {
            const input = project(driver, 'vented');
            input.box.port = { shape: 'round', diameter_m, count };
            return input;
        };
        const tooLarge = suggestBox(withPort(0.07));

        if (tooLarge.ok || tooLarge.reason !== 'portTooLarge') {
            throw new Error('recusa esperada');
        }

        expect(relative(tooLarge.max_port_area_m2, maxArea)).toBeLessThan(
            1e-12,
        );
        expect(
            relative(tooLarge.port_area_m2, (Math.PI * 0.07 ** 2) / 4),
        ).toBeLessThan(1e-12);
        // Conta a área total: dois dutos que juntos passam do limite também são recusados.
        const half = Math.sqrt((4 * 0.6 * maxArea) / Math.PI);
        expect(suggestBox(withPort(half, 2))).toMatchObject({
            reason: 'portTooLarge',
        });

        // Logo abaixo do limite a sugestão sai, e a simulação volta ao volume do alinhamento
        // (antes, acima do limite, ela caía na outra raiz com duto mais curto).
        const input = withPort(Math.sqrt((4 * 0.99 * maxArea) / Math.PI));
        const suggestion = suggestBox(input);

        if (!suggestion.ok) {
            throw new Error('sugestão esperada');
        }

        const result = simulate({
            ...input,
            box: {
                ...input.box,
                vb_m3: suggestion.vb_m3,
                fb_hz: suggestion.fb_hz,
            },
        });
        expect(relative(result.results.net_volume_m3, net)).toBeLessThan(1e-9);
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
