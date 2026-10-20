import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vite-plus/test';
import { createConnectivity } from './connectivity';

function setup({ online = true, reachable = true } = {}) {
    const target = new EventTarget();
    const state = { online, reachable };
    const probe = vi.fn(async () => state.reachable);
    const connectivity = createConnectivity({
        probe,
        onLine: () => state.online,
        target,
    });

    connectivity.start();

    return { connectivity, target, state, probe };
}

describe('detecção de conexão', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('oscilação menor que 2 s não muda o estado', async () => {
        const { connectivity, target } = setup();
        await vi.advanceTimersByTimeAsync(2500);

        target.dispatchEvent(new Event('offline'));
        await vi.advanceTimersByTimeAsync(1000);
        target.dispatchEvent(new Event('online'));
        await vi.advanceTimersByTimeAsync(3000);

        expect(connectivity.getStatus()).toBe('online');
    });

    test('offline estável por 2 s vira offline', async () => {
        const { connectivity, target, state } = setup();
        await vi.advanceTimersByTimeAsync(2500);

        state.online = false;
        target.dispatchEvent(new Event('offline'));
        await vi.advanceTimersByTimeAsync(1999);

        expect(connectivity.getStatus()).toBe('online');

        await vi.advanceTimersByTimeAsync(1);

        expect(connectivity.getStatus()).toBe('offline');
    });

    test('servidor sem resposta com navigator.onLine verdadeiro vira offline', async () => {
        const { connectivity } = setup({ online: true, reachable: false });

        await vi.advanceTimersByTimeAsync(2100);

        expect(connectivity.getStatus()).toBe('offline');
    });

    test('quando o servidor volta a responder, volta a online em até 5 s', async () => {
        const { connectivity, state } = setup({ reachable: false });
        await vi.advanceTimersByTimeAsync(2100);
        expect(connectivity.getStatus()).toBe('offline');

        state.reachable = true;
        await vi.advanceTimersByTimeAsync(5000);

        expect(connectivity.getStatus()).toBe('online');
    });

    test('avisa os assinantes a cada mudança', async () => {
        const { connectivity } = setup({ reachable: false });
        const listener = vi.fn();
        connectivity.subscribe(listener);

        await vi.advanceTimersByTimeAsync(2100);

        expect(listener).toHaveBeenCalledTimes(1);
    });
});
