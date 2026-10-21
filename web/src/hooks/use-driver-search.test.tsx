import { act, renderHook } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vite-plus/test';
import { searchDrivers } from '@/lib/catalog/client';
import type { DriverSummary, SearchResponse } from '@/lib/catalog/types';
import { useDriverSearch } from './use-driver-search';

vi.mock('@/lib/catalog/client', () => ({ searchDrivers: vi.fn() }));

const search = vi.mocked(searchDrivers);

function summary(id: number): DriverSummary {
    return {
        id,
        brand: 'Triton',
        model: `TR ${id}`,
        variant: null,
        fs_hz: 50,
        qts: 0.4,
        vas_m3: 0.05,
    };
}

function response(ids: number[], hasMore = false): SearchResponse {
    return {
        data: ids.map(summary),
        meta: { limit: 20, has_more: hasMore },
    };
}

function deferred() {
    let resolve!: (value: Awaited<ReturnType<typeof searchDrivers>>) => void;
    const promise = new Promise<Awaited<ReturnType<typeof searchDrivers>>>(
        (done) => {
            resolve = done;
        },
    );

    return { promise, resolve };
}

beforeEach(() => {
    vi.useFakeTimers();
    search.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('useDriverSearch', () => {
    test('com menos de 2 caracteres depois de aparar não busca', async () => {
        const { result } = renderHook(() => useDriverSearch(' a '));

        await act(() => vi.advanceTimersByTimeAsync(1000));

        expect(search).not.toHaveBeenCalled();
        expect(result.current.status).toBe('idle');
    });

    test('espera 300 ms depois da última tecla', async () => {
        search.mockResolvedValue({ ok: true, data: response([1]) });
        renderHook(() => useDriverSearch('tr'));

        await act(() => vi.advanceTimersByTimeAsync(299));
        expect(search).not.toHaveBeenCalled();

        await act(() => vi.advanceTimersByTimeAsync(1));
        expect(search).toHaveBeenCalledTimes(1);
        expect(search.mock.calls[0][0]).toBe('tr');
    });

    test('apara o termo e corta em 60 caracteres', async () => {
        search.mockResolvedValue({ ok: true, data: response([]) });
        renderHook(() => useDriverSearch(`  ${'a'.repeat(80)}  `));

        await act(() => vi.advanceTimersByTimeAsync(300));

        expect(search.mock.calls[0][0]).toBe('a'.repeat(60));
    });

    test('vai de idle a loading e a ready com a lista e has_more', async () => {
        search.mockResolvedValue({ ok: true, data: response([1, 2], true) });
        const { result, rerender } = renderHook(
            ({ term }) => useDriverSearch(term),
            { initialProps: { term: '' } },
        );
        expect(result.current.status).toBe('idle');

        rerender({ term: 'tr' });
        expect(result.current.status).toBe('loading');

        await act(() => vi.advanceTimersByTimeAsync(300));

        expect(result.current.status).toBe('ready');
        expect(result.current.items.map((item) => item.id)).toEqual([1, 2]);
        expect(result.current.hasMore).toBe(true);
    });

    test('digitar de novo aborta o pedido anterior e só o último resultado vale', async () => {
        const first = deferred();
        const second = deferred();
        search
            .mockReturnValueOnce(first.promise)
            .mockReturnValueOnce(second.promise);
        const { result, rerender } = renderHook(
            ({ term }) => useDriverSearch(term),
            { initialProps: { term: 'tr' } },
        );

        await act(() => vi.advanceTimersByTimeAsync(300));
        const firstSignal = search.mock.calls[0][1];

        rerender({ term: 'tr 1' });
        expect(firstSignal?.aborted).toBe(true);

        await act(() => vi.advanceTimersByTimeAsync(300));

        await act(async () => {
            second.resolve({ ok: true, data: response([2]) });
            await Promise.resolve();
        });
        await act(async () => {
            first.resolve({ ok: true, data: response([1]) });
            await Promise.resolve();
        });

        expect(result.current.items.map((item) => item.id)).toEqual([2]);
    });

    test('sem conexão não busca e fica idle', async () => {
        const { result } = renderHook(() =>
            useDriverSearch('triton', { offline: true }),
        );

        await act(() => vi.advanceTimersByTimeAsync(1000));

        expect(search).not.toHaveBeenCalled();
        expect(result.current.status).toBe('idle');
    });

    test('erro vira status error e retry busca de novo', async () => {
        search
            .mockResolvedValueOnce({ ok: false, error: 'server' })
            .mockResolvedValueOnce({ ok: true, data: response([3]) });
        const { result } = renderHook(() => useDriverSearch('tr'));

        await act(() => vi.advanceTimersByTimeAsync(300));
        expect(result.current.status).toBe('error');
        expect(result.current.error).toBe('server');

        act(() => result.current.retry());
        await act(() => vi.advanceTimersByTimeAsync(300));

        expect(result.current.status).toBe('ready');
        expect(result.current.items.map((item) => item.id)).toEqual([3]);
        expect(result.current.error).toBeUndefined();
    });

    test('esvaziar o campo volta a idle e limpa a lista', async () => {
        search.mockResolvedValue({ ok: true, data: response([1]) });
        const { result, rerender } = renderHook(
            ({ term }) => useDriverSearch(term),
            { initialProps: { term: 'tr' } },
        );
        await act(() => vi.advanceTimersByTimeAsync(300));
        expect(result.current.items).toHaveLength(1);

        rerender({ term: '' });

        expect(result.current.status).toBe('idle');
        expect(result.current.items).toEqual([]);
    });
});
