import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { fetchDriver, searchDrivers } from './client';

const SUMMARY = {
    id: 2,
    brand: 'Triton',
    model: 'TR 620 12"',
    variant: '4 Ω',
    fs_hz: 76.94,
    qts: 0.717,
    vas_m3: 0.026348,
};

function respond(status: number, body: unknown = {}) {
    return Promise.resolve(
        new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
        }),
    );
}

function mockFetch(
    impl: (url: string, init?: RequestInit) => Promise<Response>,
) {
    const fetchMock = vi.fn(impl);
    vi.stubGlobal('fetch', fetchMock);

    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('searchDrivers', () => {
    test('chama a rota de busca com o termo codificado e devolve os dados', async () => {
        const body = {
            data: [SUMMARY],
            meta: { limit: 20, has_more: false },
        };
        const fetchMock = mockFetch(() => respond(200, body));

        const result = await searchDrivers('tr 620');

        expect(String(fetchMock.mock.calls[0][0])).toMatch(
            /\/api\/drivers\?q=tr%20620$/,
        );
        expect(result).toEqual({ ok: true, data: body });
    });

    test('repassa o sinal de cancelamento ao fetch', async () => {
        const fetchMock = mockFetch(() =>
            respond(200, { data: [], meta: { limit: 20, has_more: false } }),
        );
        const controller = new AbortController();

        await searchDrivers('tr', controller.signal);

        expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
    });

    test.each([
        [429, 'rateLimited'],
        [422, 'invalid'],
        [500, 'server'],
        [503, 'server'],
    ])('status %s vira %s', async (status, error) => {
        mockFetch(() => respond(status, { message: 'x' }));

        expect(await searchDrivers('tr')).toEqual({ ok: false, error });
    });

    test('falha de rede vira network', async () => {
        mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

        expect(await searchDrivers('tr')).toEqual({
            ok: false,
            error: 'network',
        });
    });

    test('corpo com formato errado vira invalid', async () => {
        mockFetch(() => respond(200, { data: 'x' }));

        expect(await searchDrivers('tr')).toEqual({
            ok: false,
            error: 'invalid',
        });
    });

    test('resposta fora da faixa vira invalid', async () => {
        mockFetch(() =>
            respond(200, {
                data: [{ ...SUMMARY, fs_hz: 0 }],
                meta: { limit: 20, has_more: false },
            }),
        );

        expect(await searchDrivers('tr')).toEqual({
            ok: false,
            error: 'invalid',
        });
    });

    test('corpo que não é JSON vira invalid', async () => {
        mockFetch(() =>
            Promise.resolve(new Response('<html>', { status: 200 })),
        );

        expect(await searchDrivers('tr')).toEqual({
            ok: false,
            error: 'invalid',
        });
    });

    test('pedido abortado devolve aborted sem lançar', async () => {
        mockFetch(() =>
            Promise.reject(new DOMException('Aborted', 'AbortError')),
        );

        expect(await searchDrivers('tr')).toEqual({ ok: false, aborted: true });
    });
});

describe('fetchDriver', () => {
    test('chama a rota de detalhe e valida o driver', async () => {
        const body = { data: { ...SUMMARY, source: 'ficha' } };
        const fetchMock = mockFetch(() => respond(200, body));

        const result = await fetchDriver(2);

        expect(String(fetchMock.mock.calls[0][0])).toMatch(
            /\/api\/drivers\/2$/,
        );
        expect(result).toEqual({ ok: true, data: body });
    });

    test('404 vira notFound', async () => {
        mockFetch(() => respond(404, { message: 'x' }));

        expect(await fetchDriver(9)).toEqual({ ok: false, error: 'notFound' });
    });

    test('parâmetro fora da faixa vira invalid', async () => {
        mockFetch(() =>
            respond(200, {
                data: { ...SUMMARY, fs_hz: 0, source: 'ficha' },
            }),
        );

        expect(await fetchDriver(2)).toEqual({ ok: false, error: 'invalid' });
    });
});
