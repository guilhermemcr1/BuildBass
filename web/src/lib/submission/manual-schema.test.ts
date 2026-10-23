import { describe, expect, test } from 'vite-plus/test';
import { parseManualResponse } from './manual-schema';

function body(overrides: Record<string, unknown> = {}) {
    return {
        data: {
            suggestion: {
                brand: ' Triton ',
                model: 'TR 620',
                variant: null,
                type: 'woofer',
                fs_hz: 76.94,
                qts: 0.717,
                vas_m3: 0.026348,
                re_ohm: null,
            },
            suspect: [],
            discarded: [],
            warnings: ['review'],
            ...overrides,
        },
    };
}

describe('parseManualResponse', () => {
    test('lê a sugestão, aparando textos e ignorando nulos', () => {
        const result = parseManualResponse(body());

        expect(result?.suggestion.brand).toBe('Triton');
        expect(result?.suggestion.variant).toBeUndefined();
        expect(result?.suggestion.type).toBe('woofer');
        expect(result?.suggestion.numbers).toEqual({
            fs_hz: 76.94,
            qts: 0.717,
            vas_m3: 0.026348,
        });
        expect(result?.warnings).toEqual(['review']);
    });

    test('descarta número fora das faixas, mesmo vindo do servidor', () => {
        const result = parseManualResponse(
            body({ suggestion: { fs_hz: 50_000, qts: 0.4 } }),
        );

        expect(result?.suggestion.numbers).toEqual({ qts: 0.4 });
    });

    test('ignora tipo, avisos e chaves desconhecidos', () => {
        const result = parseManualResponse(
            body({
                suggestion: { type: 'tweeter', fs_hz: 40, extra: 1 },
                warnings: ['review', 'outro'],
                suspect: ['qts', 'xyz'],
                discarded: ['vas_m3', 'abc'],
            }),
        );

        expect(result?.suggestion.type).toBeUndefined();
        expect(result?.warnings).toEqual(['review']);
        expect(result?.discarded).toEqual(['vas_m3']);
    });

    test('suspeito só vale para campo que chegou preenchido', () => {
        const result = parseManualResponse(
            body({
                suggestion: { fs_hz: 40, qts: 0.9 },
                suspect: ['qts', 'qes'],
            }),
        );

        expect(result?.suspect).toEqual(['qts']);
    });

    test('resposta fora do formato devolve undefined', () => {
        expect(parseManualResponse({})).toBeUndefined();
        expect(parseManualResponse(null)).toBeUndefined();
        expect(
            parseManualResponse({ data: { suggestion: 3 } }),
        ).toBeUndefined();
    });
});
