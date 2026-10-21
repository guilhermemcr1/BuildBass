// Cloudflare Turnstile em modo invisível (specs/006, research.md §5). O script só é carregado
// quando alguém envia um driver e só existe com VITE_TURNSTILE_SITE_KEY; sem a chave (desenvolvimento)
// o envio segue sem token e o servidor, com a verificação desligada, aceita.

const SCRIPT_URL =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const TIMEOUT_MS = 15_000;

type TurnstileApi = {
    render: (
        container: HTMLElement,
        options: {
            sitekey: string;
            execution: 'execute';
            callback: (token: string) => void;
            'error-callback': () => void;
            'expired-callback': () => void;
        },
    ) => string;
    execute: (container: HTMLElement) => void;
    remove: (widgetId: string) => void;
};

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

export type TokenResult = { ok: true; token?: string } | { ok: false };

let loading: Promise<boolean> | undefined;

function loadScript(): Promise<boolean> {
    if (window.turnstile !== undefined) {
        return Promise.resolve(true);
    }

    loading ??= new Promise<boolean>((resolve) => {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        script.addEventListener('load', () =>
            resolve(window.turnstile !== undefined),
        );
        script.addEventListener('error', () => {
            script.remove();
            resolve(false);
        });
        document.head.append(script);
    });

    // Terminada a carga (com sucesso `window.turnstile` já existe; com falha, tenta-se de novo).
    const current = loading;
    void current.finally(() => {
        if (loading === current) {
            loading = undefined;
        }
    });

    return current;
}

export async function getTurnstileToken(
    siteKey: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY,
): Promise<TokenResult> {
    if (siteKey === undefined || siteKey === '') {
        return { ok: true };
    }

    if (!(await loadScript()) || window.turnstile === undefined) {
        return { ok: false };
    }

    const api = window.turnstile;
    const container = document.createElement('div');
    document.body.append(container);

    return new Promise<TokenResult>((resolve) => {
        let widgetId: string | undefined;
        const finish = (result: TokenResult) => {
            clearTimeout(timer);

            if (widgetId !== undefined) {
                api.remove(widgetId);
            }

            container.remove();
            resolve(result);
        };
        const timer = setTimeout(() => finish({ ok: false }), TIMEOUT_MS);

        widgetId = api.render(container, {
            sitekey: siteKey,
            execution: 'execute',
            callback: (token) => finish({ ok: true, token }),
            'error-callback': () => finish({ ok: false }),
            'expired-callback': () => finish({ ok: false }),
        });
        api.execute(container);
    });
}
