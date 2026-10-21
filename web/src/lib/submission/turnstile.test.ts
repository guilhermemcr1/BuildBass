import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vite-plus/test';
import { getTurnstileToken } from './turnstile';

function scripts() {
    return document.head.querySelectorAll('script[src*="turnstile"]');
}

function stubApi(outcome: { token: string } | { error: true }) {
    window.turnstile = {
        render: vi.fn((_container, options) => {
            queueMicrotask(() => {
                if ('error' in outcome) {
                    options['error-callback']();
                } else {
                    options.callback(outcome.token);
                }
            });

            return 'widget-1';
        }),
        execute: vi.fn(),
        remove: vi.fn(),
    };
}

beforeEach(() => {
    delete window.turnstile;
    document.head.innerHTML = '';
    document.body.innerHTML = '';
});

afterEach(() => {
    delete window.turnstile;
});

describe('getTurnstileToken', () => {
    test('sem chave não carrega script nem devolve token', async () => {
        expect(await getTurnstileToken(undefined)).toEqual({ ok: true });
        expect(await getTurnstileToken('')).toEqual({ ok: true });
        expect(scripts()).toHaveLength(0);
    });

    test('com chave devolve o token do widget e limpa o widget', async () => {
        stubApi({ token: 'tok-123' });

        const result = await getTurnstileToken('site-key');

        expect(result).toEqual({ ok: true, token: 'tok-123' });
        expect(window.turnstile?.remove).toHaveBeenCalledWith('widget-1');
        expect(document.body.children).toHaveLength(0);
        // Já carregado: não injeta o script de novo.
        expect(scripts()).toHaveLength(0);
    });

    test('erro do widget vira falha sem lançar', async () => {
        stubApi({ error: true });

        expect(await getTurnstileToken('site-key')).toEqual({ ok: false });
    });

    test('injeta o script uma única vez e espera o carregamento', async () => {
        const first = getTurnstileToken('site-key');
        const second = getTurnstileToken('site-key');

        expect(scripts()).toHaveLength(1);

        stubApi({ token: 'tok-abc' });
        scripts()[0].dispatchEvent(new Event('load'));

        expect(await first).toEqual({ ok: true, token: 'tok-abc' });
        expect(await second).toEqual({ ok: true, token: 'tok-abc' });
    });

    test('falha ao carregar o script vira falha e permite nova tentativa', async () => {
        const failed = getTurnstileToken('site-key');
        scripts()[0].dispatchEvent(new Event('error'));

        expect(await failed).toEqual({ ok: false });

        const retry = getTurnstileToken('site-key');
        expect(scripts()).toHaveLength(1);

        stubApi({ token: 'tok-2' });
        scripts()[0].dispatchEvent(new Event('load'));

        expect(await retry).toEqual({ ok: true, token: 'tok-2' });
    });
});
