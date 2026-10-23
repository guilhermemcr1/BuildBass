import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { fetchBrands, fetchDriver, searchDrivers } from './client';

const DRIVER_ID = '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10';

const SUMMARY = {
    id: DRIVER_ID,
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

        await searchDrivers('tr', {}, controller.signal);

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

        const result = await fetchDriver(DRIVER_ID);

        expect(String(fetchMock.mock.calls[0][0])).toMatch(
            new RegExp(`/api/drivers/${DRIVER_ID}$`),
        );
        // A chave `images` pode faltar na resposta: o schema assume lista vazia.
        expect(result).toEqual({
            ok: true,
            data: { data: { ...body.data, images: [] } },
        });
    });

    test('404 vira notFound', async () => {
        mockFetch(() => respond(404, { message: 'x' }));

        expect(
            await fetchDriver('0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a99'),
        ).toEqual({ ok: false, error: 'notFound' });
    });

    test('parâmetro fora da faixa vira invalid', async () => {
        mockFetch(() =>
            respond(200, {
                data: { ...SUMMARY, fs_hz: 0, source: 'ficha' },
            }),
        );

        expect(await fetchDriver(DRIVER_ID)).toEqual({
            ok: false,
            error: 'invalid',
        });
    });
});

describe('filtros e marcas', () => {
    test('os filtros entram na query; sem texto não há q', async () => {
        const fetchMock = mockFetch(() =>
            respond(200, { data: [], meta: { limit: 20, has_more: false } }),
        );

        await searchDrivers('', {
            brand: 'Alfa Áudio',
            type: 'subwoofer',
            diameter_min_m: 0.28,
            diameter_max_m: 0.33,
        });
        await searchDrivers('12', { brand: 'Beta' });

        expect(String(fetchMock.mock.calls[0][0])).toMatch(
            /\/api\/drivers\?brand=Alfa%20%C3%81udio&type=subwoofer&diameter_min_m=0\.28&diameter_max_m=0\.33$/,
        );
        expect(String(fetchMock.mock.calls[1][0])).toMatch(
            /\/api\/drivers\?q=12&brand=Beta$/,
        );
    });

    test('devolve o tipo e o diâmetro do resumo e recusa tipo desconhecido', async () => {
        mockFetch(() =>
            respond(200, {
                data: [
                    {
                        ...SUMMARY,
                        type: 'subwoofer',
                        nominal_diameter_m: 0.3048,
                    },
                ],
                meta: { limit: 20, has_more: false },
            }),
        );
        const ok = await searchDrivers('tr');

        expect(ok.ok && ok.data.data[0].type).toBe('subwoofer');

        mockFetch(() =>
            respond(200, {
                data: [{ ...SUMMARY, type: 'tuba' }],
                meta: { limit: 20, has_more: false },
            }),
        );

        expect(await searchDrivers('tr')).toEqual({
            ok: false,
            error: 'invalid',
        });
    });

    test('lista as marcas e recusa resposta fora do formato', async () => {
        const fetchMock = mockFetch(() =>
            respond(200, { data: ['Alfa', 'Beta'] }),
        );

        expect(await fetchBrands()).toEqual({
            ok: true,
            data: { data: ['Alfa', 'Beta'] },
        });
        expect(String(fetchMock.mock.calls[0][0])).toMatch(
            /\/api\/driver-brands$/,
        );

        mockFetch(() => respond(200, { data: [1] }));

        expect(await fetchBrands()).toEqual({ ok: false, error: 'invalid' });
    });
});
