import { apiUrl } from './api';

export type ConnectionStatus = 'online' | 'offline';

type ConnectivityOptions = {
    probe?: () => Promise<boolean>;
    onLine?: () => boolean;
    target?: EventTarget;
    stableMs?: number;
    retryMs?: number;
};

export type Connectivity = {
    start: () => void;
    stop: () => void;
    getStatus: () => ConnectionStatus;
    subscribe: (listener: () => void) => () => void;
};

const PROBE_TIMEOUT_MS = 3000;

// Confirma no /up da API, que é o que importa para catálogo e envio: navigator.onLine diz só
// que há rede, não que o servidor responde.
async function probeApi(): Promise<boolean> {
    try {
        const response = await fetch(apiUrl('/up'), {
            method: 'HEAD',
            cache: 'no-store',
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });

        return response.ok;
    } catch {
        return false;
    }
}

export function createConnectivity({
    probe = probeApi,
    onLine = () => navigator.onLine,
    target = window,
    stableMs = 2000,
    retryMs = 5000,
}: ConnectivityOptions = {}): Connectivity {
    let status: ConnectionStatus = 'online';
    let candidate: ConnectionStatus | undefined;
    let candidateTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setInterval> | undefined;
    const listeners = new Set<() => void>();

    // Histerese: uma mudança só vale depois de `stableMs` sem voltar atrás, para o aviso não
    // piscar quando a rede oscila.
    const propose = (next: ConnectionStatus) => {
        if (next === status) {
            clearTimeout(candidateTimer);
            candidate = undefined;
            return;
        }

        if (candidate === next) {
            return;
        }

        candidate = next;
        clearTimeout(candidateTimer);
        candidateTimer = setTimeout(() => {
            status = next;
            candidate = undefined;
            listeners.forEach((listener) => listener());
        }, stableMs);
    };

    const check = async () => {
        const reachable = onLine() && (await probe());
        propose(reachable ? 'online' : 'offline');
    };

    const handleOffline = () => propose('offline');
    const handleOnline = () => void check();

    return {
        start() {
            target.addEventListener('offline', handleOffline);
            target.addEventListener('online', handleOnline);
            retryTimer = setInterval(() => {
                if (status === 'offline' || candidate === 'offline') {
                    void check();
                }
            }, retryMs);
            void check();
        },
        stop() {
            target.removeEventListener('offline', handleOffline);
            target.removeEventListener('online', handleOnline);
            clearInterval(retryTimer);
            clearTimeout(candidateTimer);
        },
        getStatus: () => status,
        subscribe(listener) {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
    };
}
