import { useSyncExternalStore } from 'react';
import { createConnectivity } from '@/lib/connectivity';
import type { Connectivity, ConnectionStatus } from '@/lib/connectivity';

let shared: Connectivity | undefined;

function connectivity(): Connectivity {
    if (shared === undefined) {
        shared = createConnectivity();
        shared.start();
    }

    return shared;
}

export function useOnlineStatus(): ConnectionStatus {
    return useSyncExternalStore(
        (listener) => connectivity().subscribe(listener),
        () => connectivity().getStatus(),
        () => 'online',
    );
}
