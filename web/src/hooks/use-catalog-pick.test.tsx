import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { fetchDriver } from '@/lib/catalog/client';
import type { CatalogDriver, DriverSummary } from '@/lib/catalog/types';
import { useRecentDrivers } from '@/stores/recent-drivers';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { useCatalogPick } from './use-catalog-pick';

vi.mock('@/lib/catalog/client', () => ({
    searchDrivers: vi.fn(),
    fetchDriver: vi.fn(),
}));

const detail = vi.mocked(fetchDriver);

const SUMMARY: DriverSummary = {
    id: '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10',
    brand: 'Triton',
    model: 'TR 620 12"',
    variant: '4 Ω',
    fs_hz: 76.94,
    qts: 0.717,
    vas_m3: 0.026348,
};

const DRIVER: CatalogDriver = {
    ...SUMMARY,
    qes: 0.779,
    qms: 8.978,
    re_ohm: 3,
    source: 'ficha',
};

beforeEach(() => {
    localStorage.clear();
    useWorkspace.setState(initialWorkspace());
    useRecentDrivers.setState({ items: [] });
    detail.mockReset();
    detail.mockResolvedValue({ ok: true, data: { data: DRIVER } });
});

describe('useCatalogPick', () => {
    test('escolher busca o detalhe, copia para o projeto ativo e registra nos recentes', async () => {
        const { result } = renderHook(() => useCatalogPick());

        let done = false;
        await act(async () => {
            done = await result.current.choose(SUMMARY);
        });

        expect(done).toBe(true);
        expect(detail).toHaveBeenCalledWith(SUMMARY.id);
        const { data } = activeProjectStore().getState();
        expect(data.driver.fs_hz).toBe(76.94);
        expect(data.driverSource).toEqual({
            brand: 'Triton',
            model: 'TR 620 12"',
            variant: '4 Ω',
        });
        expect(useRecentDrivers.getState().items).toEqual([
            {
                id: SUMMARY.id,
                brand: 'Triton',
                model: 'TR 620 12"',
                variant: '4 Ω',
                fs_hz: 76.94,
                qts: 0.717,
                vas_m3: 0.026348,
            },
        ]);
    });

    test('mostra "applying" enquanto o detalhe não chega', async () => {
        let finish!: () => void;
        detail.mockReturnValue(
            new Promise((resolve) => {
                finish = () => resolve({ ok: true, data: { data: DRIVER } });
            }),
        );
        const { result } = renderHook(() => useCatalogPick());

        act(() => {
            void result.current.choose(SUMMARY);
        });
        await waitFor(() => expect(result.current.applying).toBe(true));

        act(() => finish());
        await waitFor(() => expect(result.current.applying).toBe(false));
    });

    test.each(['network', 'server', 'invalid', 'notFound'] as const)(
        'falha %s deixa o projeto idêntico e não registra recente (FR-009)',
        async (error) => {
            detail.mockResolvedValue({ ok: false, error });
            const { result } = renderHook(() => useCatalogPick());
            const before = activeProjectStore().getState().data;

            let done = true;
            await act(async () => {
                done = await result.current.choose(SUMMARY);
            });

            expect(done).toBe(false);
            expect(result.current.applyError).toBe(error);
            expect(activeProjectStore().getState().data).toBe(before);
            expect(useRecentDrivers.getState().items).toEqual([]);
        },
    );

    test('clearError e uma nova tentativa limpam a falha', async () => {
        detail.mockResolvedValueOnce({ ok: false, error: 'server' });
        const { result } = renderHook(() => useCatalogPick());

        await act(async () => {
            await result.current.choose(SUMMARY);
        });
        expect(result.current.applyError).toBe('server');

        await act(async () => {
            await result.current.choose(SUMMARY);
        });
        expect(result.current.applyError).toBeUndefined();

        act(() => result.current.clearError());
        expect(result.current.applyError).toBeUndefined();
    });
});
