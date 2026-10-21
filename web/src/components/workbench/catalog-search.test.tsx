import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { fetchDriver, searchDrivers } from '@/lib/catalog/client';
import type { CatalogDriver, DriverSummary } from '@/lib/catalog/types';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { CatalogSearch } from './catalog-search';

vi.mock('@/lib/catalog/client', () => ({
    searchDrivers: vi.fn(),
    fetchDriver: vi.fn(),
}));

const search = vi.mocked(searchDrivers);
const detail = vi.mocked(fetchDriver);

const SUMMARY: DriverSummary = {
    id: 2,
    brand: 'Triton',
    model: 'TR 620 12"',
    variant: '4 Ω',
    fs_hz: 76.94,
    qts: 0.717,
    vas_m3: 0.026348,
};

const DRIVER: CatalogDriver = {
    ...SUMMARY,
    nominal_diameter_m: 0.3048,
    qes: 0.779,
    qms: 8.978,
    re_ohm: 3,
    le_h: 0.000607,
    xmax_m: 0.00635,
    sd_m2: 0.05309,
    pe_w: 620,
    bl_tm: 10.9,
    mms_kg: 0.06392,
    vd_m3: 0.000333,
    source: 'ficha',
};

function listing(items: DriverSummary[] = [SUMMARY], hasMore = false) {
    return {
        ok: true as const,
        data: { data: items, meta: { limit: 20, has_more: hasMore } },
    };
}

function box() {
    return screen.getByRole('combobox', { name: 'Catálogo de drivers' });
}

async function typeAndOpen(text = 'tr 6') {
    await userEvent.type(box(), text);

    return screen.findByRole('option', { name: /Triton/ }, { timeout: 2000 });
}

beforeEach(() => {
    localStorage.clear();
    useWorkspace.setState(initialWorkspace());
    usePreferences.setState({ unitSystem: 'metric' });
    search.mockReset();
    detail.mockReset();
    search.mockResolvedValue(listing());
    detail.mockResolvedValue({ ok: true, data: { data: DRIVER } });
});

describe('CatalogSearch — buscar e copiar (US1)', () => {
    test('mostra fabricante, modelo, variação e a linha de apoio', async () => {
        renderWithProviders(<CatalogSearch />);

        const option = await typeAndOpen();

        expect(option).toHaveTextContent('Triton TR 620 12" (4 Ω)');
        expect(option).toHaveTextContent('Fs 76,9 Hz · Qts 0,72 · Vas 26,3 L');
        expect(search.mock.calls[0][0]).toBe('tr 6');
    });

    test('no sistema imperial a linha mostra o Vas em ft³', async () => {
        usePreferences.setState({ unitSystem: 'imperial' });
        renderWithProviders(<CatalogSearch />);

        const option = await typeAndOpen();

        expect(option).toHaveTextContent(/Vas 0,93 ft³/);
    });

    test('Enter no item copia o driver exato, define a origem e esvazia o campo', async () => {
        renderWithProviders(<CatalogSearch />);
        activeProjectStore().getState().setDriverValue('xmax_m', 0.02);

        await typeAndOpen();
        await userEvent.keyboard('{ArrowDown}{Enter}');

        await waitFor(() =>
            expect(activeProjectStore().getState().data.driver.fs_hz).toBe(
                76.94,
            ),
        );
        const { data } = activeProjectStore().getState();
        expect(detail).toHaveBeenCalledWith(2);
        expect(data.driver).toEqual({
            fs_hz: 76.94,
            qts: 0.717,
            qes: 0.779,
            qms: 8.978,
            vas_m3: 0.026348,
            re_ohm: 3,
            le_h: 0.000607,
            xmax_m: 0.00635,
            sd_m2: 0.05309,
            pe_w: 620,
            bl_tm: 10.9,
            mms_kg: 0.06392,
            vd_m3: 0.000333,
        });
        expect(data.driverSource).toEqual({
            brand: 'Triton',
            model: 'TR 620 12"',
            variant: '4 Ω',
        });
        expect(box()).toHaveValue('');
        expect(
            screen.queryByRole('option', { name: /Triton/ }),
        ).not.toBeInTheDocument();
    });

    test('um único desfazer restaura o driver anterior', async () => {
        renderWithProviders(<CatalogSearch />);
        const store = activeProjectStore();
        store.getState().setDriverValue('fs_hz', 30);
        // Fora da janela de agrupamento: o driver anterior é um passo separado.
        await new Promise((resolve) => setTimeout(resolve, 450));

        await typeAndOpen();
        await userEvent.keyboard('{ArrowDown}{Enter}');
        await waitFor(() =>
            expect(store.getState().data.driverSource).toBeDefined(),
        );

        act(() => store.temporal.getState().undo());

        expect(store.getState().data.driver).toEqual({ fs_hz: 30 });
        expect(store.getState().data.driverSource).toBeUndefined();
    });

    test('com duas abas só a ativa muda', async () => {
        renderWithProviders(<CatalogSearch />);
        const first = activeProjectStore();
        act(() => {
            useWorkspace.getState().newProject();
        });
        const second = activeProjectStore();
        expect(second).not.toBe(first);

        await typeAndOpen();
        await userEvent.keyboard('{ArrowDown}{Enter}');
        await waitFor(() =>
            expect(second.getState().data.driverSource).toBeDefined(),
        );

        expect(first.getState().data.driver).toEqual({});
        expect(first.getState().data.driverSource).toBeUndefined();
    });

    test('Esc fecha a lista sem copiar nada', async () => {
        renderWithProviders(<CatalogSearch />);

        await typeAndOpen();
        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
        expect(detail).not.toHaveBeenCalled();
        expect(
            activeProjectStore().getState().data.driverSource,
        ).toBeUndefined();
    });

    test('clicar no item também copia', async () => {
        renderWithProviders(<CatalogSearch />);

        const option = await typeAndOpen();
        await userEvent.click(within(option).getByText(/Triton/));

        await waitFor(() =>
            expect(
                activeProjectStore().getState().data.driverSource,
            ).toBeDefined(),
        );
    });

    test('desativado não aceita digitação e mostra o motivo', () => {
        renderWithProviders(
            <CatalogSearch
                disabled
                disabledReason="Indisponível sem conexão."
            />,
        );

        expect(box()).toBeDisabled();
        expect(screen.getByText('Indisponível sem conexão.')).toBeVisible();
        expect(search).not.toHaveBeenCalled();
    });
});
