import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { extractManual } from './manual-client';

const REQUEST = { locale: 'pt-BR' as const, trap: '' };

function pdf() {
    return new File(['%PDF-1.4'], 'ficha.pdf', { type: 'application/pdf' });
}

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

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('extractManual', () => {
    test('envia multipart com arquivo, idioma, armadilha e token', async () => {
        const fetchMock = vi.fn().mockReturnValue(
            respond(200, {
                data: {
                    suggestion: { fs_hz: 40 },
                    suspect: [],
                    discarded: [],
                    warnings: ['review'],
                },
            }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const result = await extractManual(pdf(), {
            ...REQUEST,
            turnstileToken: 'tok',
        });

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        const body = init.body as FormData;

        expect(url).toContain('/api/driver-submissions/extract');
        expect(init.method).toBe('POST');
        expect(body.get('manual')).toBeInstanceOf(File);
        expect(body.get('locale')).toBe('pt-BR');
        expect(body.get('website')).toBe('');
        expect(body.get('turnstile_token')).toBe('tok');
        expect(result.ok).toBe(true);

        if (result.ok) {
            expect(result.result.suggestion.numbers).toEqual({ fs_hz: 40 });
        }
    });

    test.each([
        [422, { code: 'unreadable' }, 'unreadable'],
        [422, { code: 'verification_failed' }, 'verification'],
        [
            422,
            { code: 'invalid_file', errors: { manual: ['not_pdf'] } },
            'notPdf',
        ],
        [
            422,
            { code: 'invalid_file', errors: { manual: ['too_large'] } },
            'tooLarge',
        ],
        [
            422,
            { code: 'invalid_file', errors: { manual: ['too_many_pages'] } },
            'invalidFile',
        ],
        [503, { code: 'unavailable' }, 'unavailable'],
        [502, { code: 'provider_failed' }, 'providerFailed'],
        [500, {}, 'server'],
        [200, { data: 'quebrado' }, 'server'],
    ])('status %i %j vira %s', async (status, body, error) => {
        vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(status, body)));

        expect(await extractManual(pdf(), REQUEST)).toEqual({
            ok: false,
            error,
        });
    });

    test('429 devolve os segundos do Retry-After', async () => {
        vi.stubGlobal(
            'fetch',
            vi
                .fn()
                .mockReturnValue(respond(429, {}, { 'Retry-After': '1800' })),
        );

        expect(await extractManual(pdf(), REQUEST)).toEqual({
            ok: false,
            error: 'rateLimited',
            retryAfterS: 1800,
        });
    });

    test('falha de rede e aborto não lançam', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));
        expect(await extractManual(pdf(), REQUEST)).toEqual({
            ok: false,
            error: 'network',
        });

        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')),
        );
        expect(await extractManual(pdf(), REQUEST)).toEqual({
            ok: false,
            aborted: true,
        });
    });
});
