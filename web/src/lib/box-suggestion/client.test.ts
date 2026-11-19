import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { createProjectData } from '@/lib/project/types';
import { requestAiSuggestion } from './client';
import type { AiCandidate, AiSuggestionRequest } from './client';
import { applyCandidate, checkCandidate } from './evaluate';

const REQUEST: AiSuggestionRequest = {
    locale: 'pt-BR',
    driver: { fs_hz: 28, qts: 0.38, vas_m3: 0.085 },
    drivers_count: 1,
    usage: 'car',
    priority: 'deep',
    website: '',
};

const VENTED: AiCandidate = {
    type: 'vented',
    vb_m3: 0.06,
    fb_hz: 32,
    port: { shape: 'round', diameter_m: 0.1, count: 1 },
    title: 'Plana',
    rationale: 'Equilíbrio.',
};

function respond(
    status: number,
    body: unknown = {},
    headers: HeadersInit = {},
) {
    return Promise.resolve(
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json', ...headers },
        }),
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('requestAiSuggestion', () => {
    test('envia JSON e devolve os candidatos conferidos', async () => {
        const fetchMock = vi
            .fn()
            .mockReturnValue(respond(200, { data: { candidates: [VENTED] } }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await requestAiSuggestion(REQUEST);

        expect(result).toEqual({ ok: true, candidates: [VENTED] });
        const [url, init] = fetchMock.mock.calls[0]!;
        expect(String(url)).toMatch(/\/api\/box-suggestions$/);
        expect(JSON.parse(init.body)).toMatchObject({
            usage: 'car',
            website: '',
        });
    });

    test('resposta fora do formato vira erro do servidor', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockReturnValue(
                respond(200, {
                    data: { candidates: [{ ...VENTED, vb_m3: -1 }] },
                }),
            ),
        );

        expect(await requestAiSuggestion(REQUEST)).toEqual({
            ok: false,
            error: 'server',
        });
    });

    test.each([
        [
            429,
            { 'Retry-After': '120' },
            { ok: false, error: 'rateLimited', retryAfterS: 120 },
        ],
        [503, {}, { ok: false, error: 'unavailable' }],
        [502, {}, { ok: false, error: 'providerFailed' }],
    ])('status %i vira o motivo certo', async (status, headers, expected) => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockReturnValue(respond(status, {}, headers)),
        );

        expect(await requestAiSuggestion(REQUEST)).toEqual(expected);
    });

    test('sem rede devolve network', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new TypeError('offline')),
        );

        expect(await requestAiSuggestion(REQUEST)).toEqual({
            ok: false,
            error: 'network',
        });
    });
});

describe('candidato no motor', () => {
    const data = (() => {
        const base = createProjectData('');

        return {
            ...base,
            driver: { ...base.driver, fs_hz: 28, qts: 0.38, vas_m3: 0.085 },
            box: { ...base.box, port: { ...base.box.port, length_m: 0.4 } },
        };
    })();

    test('aplicar troca tipo, Vb, Fb e duto e devolve a trava para a Fb', () => {
        const next = applyCandidate(data, VENTED);

        expect(next.box.type).toBe('vented');
        expect(next.box.vb_m3).toBe(0.06);
        expect(next.box.fb_hz).toBe(32);
        expect(next.box.port).toMatchObject({
            shape: 'round',
            diameter_m: 0.1,
            count: 1,
        });
        expect(next.box.port.length_m).toBeUndefined();
    });

    test('caixa viável traz os números do simulador', () => {
        const check = checkCandidate(data, VENTED);

        expect(check.usable).toBe(true);
        expect(check.f3_hz).toBeGreaterThan(20);
        expect(check.net_m3).toBeLessThan(0.06);
        expect(check.port_length_m).toBeGreaterThan(0.2);
    });

    test('duto que não cabe na caixa marca o candidato como inviável', () => {
        const check = checkCandidate(data, {
            ...VENTED,
            vb_m3: 0.01,
            fb_hz: 20,
            port: { shape: 'round', diameter_m: 0.2, count: 4 },
        });

        expect(check.usable).toBe(false);
    });
});
