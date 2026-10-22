import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { submitDriver } from './client';
import type { SubmissionPayload } from './schema';

const PROTOCOL = '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10';

const PAYLOAD: SubmissionPayload = {
    brand: 'Exemplo',
    model: 'EX-1',
    source: 'Ficha',
    contact_email: 'pessoa@exemplo.com',
    fs_hz: 40,
    qts: 0.4,
    vas_m3: 0.05,
    locale: 'pt-BR',
    website: '',
};

function respond(
    status: number,
    body: unknown = {},
    headers: HeadersInit = {},
) {
    return Promise.resolve(
        new Response(JSON.stringify(body), {
            status,
            headers: Object.assign(
                { 'Content-Type': 'application/json' },
                headers,
            ),
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

describe('submitDriver', () => {
    test('envia POST JSON e devolve o protocolo', async () => {
        const fetchMock = mockFetch(() =>
            respond(201, { data: { protocol: PROTOCOL, status: 'pending' } }),
        );

        const result = await submitDriver(PAYLOAD);

        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toMatch(/\/api\/driver-submissions$/);
        expect(init?.method).toBe('POST');
        expect(JSON.parse(init?.body as string)).toEqual(PAYLOAD);
        expect(result).toEqual({ ok: true, protocol: PROTOCOL });
    });

    test('repassa o sinal de cancelamento', async () => {
        const fetchMock = mockFetch(() =>
            respond(201, { data: { protocol: PROTOCOL, status: 'pending' } }),
        );
        const controller = new AbortController();

        await submitDriver(PAYLOAD, controller.signal);

        expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
    });

    test('422 com errors vira invalid com os campos', async () => {
        mockFetch(() =>
            respond(422, { message: 'x', errors: { fs_hz: ['fora'] } }),
        );

        expect(await submitDriver(PAYLOAD)).toEqual({
            ok: false,
            error: 'invalid',
            fieldErrors: { fs_hz: ['fora'] },
        });
    });

    test('422 verification_failed vira verification', async () => {
        mockFetch(() => respond(422, { code: 'verification_failed' }));

        expect(await submitDriver(PAYLOAD)).toEqual({
            ok: false,
            error: 'verification',
        });
    });

    test.each([
        ['already_in_catalog', 'alreadyInCatalog'],
        ['already_pending', 'alreadyPending'],
    ])('409 %s vira %s', async (code, error) => {
        mockFetch(() => respond(409, { code }));

        expect(await submitDriver(PAYLOAD)).toEqual({ ok: false, error });
    });

    test('429 lê o Retry-After', async () => {
        mockFetch(() => respond(429, {}, { 'Retry-After': '1800' }));

        expect(await submitDriver(PAYLOAD)).toEqual({
            ok: false,
            error: 'rateLimited',
            retryAfterS: 1800,
        });
    });

    test.each([500, 503])('status %s vira server', async (status) => {
        mockFetch(() => respond(status, { message: 'x' }));

        expect(await submitDriver(PAYLOAD)).toEqual({
            ok: false,
            error: 'server',
        });
    });

    test('falha de rede vira network', async () => {
        mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

        expect(await submitDriver(PAYLOAD)).toEqual({
            ok: false,
            error: 'network',
        });
    });

    test('protocolo que não é UUID vira invalid', async () => {
        mockFetch(() =>
            respond(201, { data: { protocol: 'abc', status: 'pending' } }),
        );

        expect(await submitDriver(PAYLOAD)).toEqual({
            ok: false,
            error: 'invalid',
        });
    });

    test('pedido abortado devolve aborted sem lançar', async () => {
        mockFetch(() =>
            Promise.reject(new DOMException('Aborted', 'AbortError')),
        );

        expect(await submitDriver(PAYLOAD)).toEqual({
            ok: false,
            aborted: true,
        });
    });
});
