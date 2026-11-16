import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { fetchBrands, fetchDriver, searchDrivers } from '@/lib/catalog/client';
import { resetBrandsCache } from '@/hooks/use-driver-brands';
import type { CatalogDriver, DriverSummary } from '@/lib/catalog/types';
import { usePreferences } from '@/stores/preferences';
import { useRecentDrivers } from '@/stores/recent-drivers';
import { useSavedDrivers } from '@/stores/saved-drivers';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { DriverPicker } from './driver-picker';

const DRIVER_ID = '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10';

vi.mock('@/lib/catalog/client', () => ({
    searchDrivers: vi.fn(),
    fetchDriver: vi.fn(),
    fetchBrands: vi.fn(),
}));

const search = vi.mocked(searchDrivers);
const detail = vi.mocked(fetchDriver);
const brandsOf = vi.mocked(fetchBrands);

const SUMMARY: DriverSummary = {
    id: DRIVER_ID,
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
    images: [],
};

function listing(items: DriverSummary[] = [SUMMARY], hasMore = false) {
    return {
        ok: true as const,
        data: { data: items, meta: { limit: 20, has_more: hasMore } },
    };
}

function trigger() {
    return screen.getByRole('button', { name: /^Buscar alto-falante/ });
}

async function open(props: { disabled?: boolean; onSubmit?: () => void } = {}) {
    renderWithProviders(
        <DriverPicker
            disabled={props.disabled}
            disabledReason="Indisponível sem conexão."
            onSubmitDriver={props.onSubmit ?? (() => undefined)}
        />,
    );
    await userEvent.click(trigger());

    return screen.getByRole('searchbox', { name: 'Buscar alto-falante' });
}

async function typeAndWait(input: HTMLElement, text = 'tr 6') {
    await userEvent.type(input, text);

    return screen.findByRole('option', { name: /Triton/ }, { timeout: 2000 });
}

beforeEach(() => {
    localStorage.clear();
    useWorkspace.setState(initialWorkspace());
    useRecentDrivers.setState({ items: [] });
    useSavedDrivers.setState({ items: [] });
    usePreferences.setState({ unitSystem: 'metric' });
    search.mockReset();
    detail.mockReset();
    brandsOf.mockReset();
    resetBrandsCache();
    brandsOf.mockResolvedValue({
        ok: true,
        data: { data: ['Alfa', 'Triton'] },
    });
    search.mockResolvedValue(listing());
    detail.mockResolvedValue({ ok: true, data: { data: DRIVER } });
});

describe('DriverPicker — abrir e buscar', () => {
    test('a tecla "/" abre a busca, menos de dentro de um campo', async () => {
        renderWithProviders(
            <>
                <input aria-label="Outro campo" />
                <DriverPicker onSubmitDriver={() => undefined} />
            </>,
        );

        await userEvent.type(screen.getByLabelText('Outro campo'), '/');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        await userEvent.click(document.body);
        await userEvent.keyboard('/');
        expect(await screen.findByRole('dialog')).toBeVisible();
    });

    test('o termo digitado fica destacado no nome do resultado', async () => {
        const input = await open();

        const option = await typeAndWait(input, 'trit');

        expect(within(option).getByText('Trit').tagName).toBe('MARK');
    });

    test('o botão de limpar esvazia a busca', async () => {
        const input = await open();

        await userEvent.type(input, 'tr');
        await userEvent.click(
            screen.getByRole('button', { name: 'Limpar busca' }),
        );

        expect(input).toHaveValue('');
    });

    test('o botão abre a busca com o campo focado', async () => {
        const input = await open();

        expect(input).toHaveFocus();
        expect(
            screen.getByRole('dialog', { name: 'Buscar alto-falante' }),
        ).toBeVisible();
    });

    test('vazio mostra a dica; com recentes mostra a seção "Recentes"', async () => {
        useRecentDrivers.getState().add({
            id: DRIVER_ID,
            brand: 'Triton',
            model: 'TR 620 12"',
            variant: '4 Ω',
            fs_hz: 76.94,
            qts: 0.717,
            vas_m3: 0.026348,
        });
        await open();

        expect(screen.getByText('Recentes')).toBeInTheDocument();
        expect(
            screen.getByRole('option', { name: /Triton TR 620 12" \(4 Ω\)/ }),
        ).toBeInTheDocument();
        expect(search).not.toHaveBeenCalled();
    });

    test('sem recentes mostra a dica de digitar', async () => {
        await open();

        expect(
            screen.getByText(
                'Digite ao menos 2 letras ou escolha um fabricante ou um diâmetro.',
            ),
        ).toBeInTheDocument();
    });

    test('a partir de 2 caracteres busca e mostra a seção "Catálogo" com a linha de apoio', async () => {
        const input = await open();

        const option = await typeAndWait(input);

        expect(screen.getByText('Catálogo')).toBeInTheDocument();
        expect(option).toHaveTextContent('Triton TR 620 12" (4 Ω)');
        expect(option).toHaveTextContent('Fs 76,9 Hz');
        expect(option).toHaveTextContent('Qts 0,72');
        expect(option).toHaveTextContent('Vas 26,3 L');
        expect(search.mock.calls[0][0]).toBe('tr 6');
    });

    test('no sistema imperial a linha mostra o Vas em ft³', async () => {
        usePreferences.setState({ unitSystem: 'imperial' });
        const input = await open();

        const option = await typeAndWait(input);

        expect(option).toHaveTextContent(/Vas 0,93 ft³/);
    });
});

describe('DriverPicker — escolher', () => {
    test('setas + Enter copiam o driver, fecham e devolvem o foco ao botão', async () => {
        const input = await open();
        activeProjectStore().getState().setDriverValue('xmax_m', 0.02);

        await typeAndWait(input);
        await userEvent.keyboard('{ArrowDown}{Enter}');

        await waitFor(() =>
            expect(activeProjectStore().getState().data.driver.fs_hz).toBe(
                76.94,
            ),
        );
        expect(activeProjectStore().getState().data.driverSource).toEqual({
            brand: 'Triton',
            model: 'TR 620 12"',
            variant: '4 Ω',
        });
        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
        // O React Aria devolve o foco num quadro de animação depois de fechar.
        await waitFor(() => expect(trigger()).toHaveFocus());
        expect(useRecentDrivers.getState().items).toHaveLength(1);
    });

    test('clicar no item também copia', async () => {
        const input = await open();

        const option = await typeAndWait(input);
        await userEvent.click(option);

        await waitFor(() =>
            expect(
                activeProjectStore().getState().data.driverSource,
            ).toBeDefined(),
        );
    });

    test('escolher um recente também copia o driver', async () => {
        useRecentDrivers.getState().add({
            id: DRIVER_ID,
            brand: 'Triton',
            model: 'TR 620 12"',
            variant: '4 Ω',
            fs_hz: 76.94,
            qts: 0.717,
            vas_m3: 0.026348,
        });
        await open();

        await userEvent.click(screen.getByRole('option', { name: /Triton/ }));

        await waitFor(() =>
            expect(activeProjectStore().getState().data.driver.fs_hz).toBe(
                76.94,
            ),
        );
        expect(detail).toHaveBeenCalledWith(DRIVER_ID);
    });

    test('com duas abas só a ativa muda', async () => {
        const input = await open();
        const first = activeProjectStore();
        act(() => {
            useWorkspace.getState().newProject();
        });
        const second = activeProjectStore();

        await typeAndWait(input);
        await userEvent.keyboard('{ArrowDown}{Enter}');
        await waitFor(() =>
            expect(second.getState().data.driverSource).toBeDefined(),
        );

        expect(first.getState().data.driverSource).toBeUndefined();
    });

    test('Esc fecha sem mudar o driver', async () => {
        const input = await open();

        await typeAndWait(input);
        await userEvent.keyboard('{Escape}');

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(detail).not.toHaveBeenCalled();
        expect(
            activeProjectStore().getState().data.driverSource,
        ).toBeUndefined();
    });

    test('clicar fora fecha sem mudar o driver', async () => {
        await open();

        await userEvent.click(document.body);

        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
        expect(detail).not.toHaveBeenCalled();
    });
});

describe('DriverPicker — falhas e estados', () => {
    test('sem resultado mostra a mensagem com o termo', async () => {
        search.mockResolvedValue(listing([]));
        const input = await open();

        await userEvent.type(input, 'zzzz');

        expect(
            await screen.findByText(
                'Nenhum alto-falante encontrado para “zzzz”',
                {},
                { timeout: 2000 },
            ),
        ).toBeInTheDocument();
    });

    test('mostra que está buscando enquanto o pedido não volta', async () => {
        search.mockReturnValue(new Promise(() => undefined));
        const input = await open();

        await userEvent.type(input, 'tr');

        expect(
            await screen.findByText('Buscando…', {}, { timeout: 2000 }),
        ).toBeInTheDocument();
    });

    test('erro mostra a mensagem e "Tentar de novo" refaz a busca', async () => {
        search
            .mockResolvedValueOnce({ ok: false, error: 'server' })
            .mockResolvedValueOnce(listing());
        const input = await open();

        await userEvent.type(input, 'tr 6');
        expect(
            await screen.findByText(
                'Não foi possível consultar o catálogo agora',
                {},
                { timeout: 2000 },
            ),
        ).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole('button', { name: 'Tentar de novo' }),
        );

        expect(
            await screen.findByRole(
                'option',
                { name: /Triton/ },
                { timeout: 2000 },
            ),
        ).toBeInTheDocument();
        expect(search).toHaveBeenCalledTimes(2);
    });

    test('mais resultados que o limite avisa para refinar', async () => {
        search.mockResolvedValue(listing([SUMMARY], true));
        const input = await open();

        await typeAndWait(input);

        expect(
            screen.getByText('Há mais resultados. Refine a busca.'),
        ).toBeInTheDocument();
    });

    test('driver que saiu do catálogo avisa, mantém aberto e não altera o projeto', async () => {
        detail.mockResolvedValue({ ok: false, error: 'notFound' });
        const input = await open();
        const before = activeProjectStore().getState().data;

        await typeAndWait(input);
        await userEvent.keyboard('{ArrowDown}{Enter}');

        expect(
            await screen.findByText(
                'Este alto-falante não está mais no catálogo.',
            ),
        ).toBeInTheDocument();
        expect(activeProjectStore().getState().data).toBe(before);
        expect(screen.getByRole('dialog')).toBeVisible();
    });

    test('falha ao copiar deixa o projeto idêntico', async () => {
        detail.mockResolvedValue({ ok: false, error: 'server' });
        const input = await open();
        const before = activeProjectStore().getState().data;

        await typeAndWait(input);
        await userEvent.keyboard('{ArrowDown}{Enter}');

        expect(
            await screen.findByText(
                'Não foi possível copiar este alto-falante. O projeto não foi alterado.',
            ),
        ).toBeInTheDocument();
        expect(activeProjectStore().getState().data).toBe(before);
    });

    test('mostra "Copiando parâmetros…" enquanto o detalhe não chega', async () => {
        let finish!: () => void;
        detail.mockReturnValue(
            new Promise((resolve) => {
                finish = () => resolve({ ok: true, data: { data: DRIVER } });
            }),
        );
        const input = await open();

        await typeAndWait(input);
        await userEvent.keyboard('{ArrowDown}{Enter}');

        expect(
            await screen.findByText('Copiando parâmetros…'),
        ).toBeInTheDocument();
        act(() => finish());
        await waitFor(() =>
            expect(
                activeProjectStore().getState().data.driverSource,
            ).toBeDefined(),
        );
    });
});

describe('DriverPicker — enviar e offline', () => {
    test('o rodapé "Enviar alto-falante" chama onSubmitDriver e fecha', async () => {
        const onSubmit = vi.fn();
        await open({ onSubmit });

        await userEvent.click(
            screen.getByRole('button', { name: 'Enviar alto-falante' }),
        );

        expect(onSubmit).toHaveBeenCalled();
        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
    });

    test('offline desativa catálogo e envio, mantém o campo e mostra o motivo', async () => {
        renderWithProviders(
            <DriverPicker
                disabled
                disabledReason="Indisponível sem conexão."
                onSubmitDriver={() => undefined}
            />,
        );
        await userEvent.click(trigger());

        expect(screen.getByRole('searchbox')).toBeEnabled();
        expect(
            screen.getByRole('button', { name: 'Enviar alto-falante' }),
        ).toBeDisabled();
        expect(screen.getByText('Indisponível sem conexão.')).toBeVisible();
        expect(search).not.toHaveBeenCalled();
    });
});

describe('DriverPicker — Meus alto-falantes', () => {
    const MINE = {
        brand: 'Minha',
        model: 'Sub 15',
        driver: { fs_hz: 30, qts: 0.4, vas_m3: 0.12 },
        cutout_m: 0.35,
    };

    test('mostra a seção "Meus alto-falantes" antes do catálogo, sem rede', async () => {
        useSavedDrivers.getState().save(MINE);
        await open({ disabled: true });

        const option = screen.getByRole('option', { name: /Minha Sub 15/ });

        expect(option).toBeVisible();
        expect(screen.getByText('Meus alto-falantes')).toBeVisible();
        expect(search).not.toHaveBeenCalled();
    });

    test('o texto digitado filtra os salvos a partir da primeira letra', async () => {
        useSavedDrivers.getState().save(MINE);
        useSavedDrivers
            .getState()
            .save({ ...MINE, model: 'Outro 10', brand: 'Zeta' });
        const input = await open({ disabled: true });

        await userEvent.type(input, 'zet');

        expect(
            screen.getByRole('option', { name: /Zeta Outro 10/ }),
        ).toBeVisible();
        expect(
            screen.queryByRole('option', { name: /Minha Sub 15/ }),
        ).not.toBeInTheDocument();
    });

    test('escolher aplica driver, origem e recorte numa etapa só de desfazer', async () => {
        useSavedDrivers.getState().save(MINE);
        await open({ disabled: true });
        const steps =
            activeProjectStore().temporal.getState().pastStates.length;

        await userEvent.click(
            screen.getByRole('option', { name: /Minha Sub 15/ }),
        );

        const { data } = activeProjectStore().getState();
        expect(data.driver).toEqual(MINE.driver);
        expect(data.driverSource).toEqual({ brand: 'Minha', model: 'Sub 15' });
        expect(data.cutPlan?.cutout_m).toBe(0.35);
        expect(
            activeProjectStore().temporal.getState().pastStates,
        ).toHaveLength(steps + 1);
        await waitFor(() =>
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
        );
    });
});

describe('DriverPicker — filtros e detalhes (marca, diâmetro, tipo)', () => {
    const TYPED: DriverSummary = {
        ...SUMMARY,
        type: 'subwoofer',
        nominal_diameter_m: 0.3048,
    };

    // O menu do filtro não abre no jsdom dentro do Autocomplete (no navegador abre), mas o React
    // Aria mantém um <select> nativo escondido ao lado de cada um: é por ele que o teste escolhe.
    async function pickFilter(label: string, option: string) {
        const field = screen
            .getAllByText(label, { selector: 'span, label' })
            .map((node) => node.closest('div'))
            .find((box) => box?.querySelector('select') !== null);
        const native = field?.querySelector('select') as HTMLSelectElement;

        await userEvent.selectOptions(native, option);
    }

    test('cada resultado traz o tipo e o diâmetro, além de Fs, Qts e Vas', async () => {
        search.mockResolvedValue(listing([TYPED]));
        const input = await open();

        const option = await typeAndWait(input);

        expect(option).toHaveTextContent('Subwoofer · Ø 304,8 mm');
        expect(option).toHaveTextContent('Fs 76,9 Hz');
    });

    test('resultado sem tipo nem diâmetro não ganha a linha extra', async () => {
        const input = await open();

        const option = await typeAndWait(input);

        expect(option).not.toHaveTextContent('Ø');
    });

    test('escolher uma marca busca sem texto e lista o que combina', async () => {
        search.mockResolvedValue(listing([TYPED]));
        await open();

        await pickFilter('Fabricante', 'Triton');

        const option = await screen.findByRole(
            'option',
            { name: /Triton/ },
            { timeout: 2000 },
        );

        expect(option).toBeVisible();
        expect(search).toHaveBeenLastCalledWith(
            '',
            { brand: 'Triton' },
            expect.any(AbortSignal),
        );
    });

    test('a faixa de diâmetro vira os limites em metros, somada ao texto', async () => {
        search.mockResolvedValue(listing([TYPED]));
        const input = await open();

        await pickFilter('Diâmetro', '12″');
        await userEvent.type(input, 'tr');
        await screen.findByRole(
            'option',
            { name: /Triton/ },
            { timeout: 2000 },
        );

        const [term, filters] = search.mock.calls.at(-1) ?? [];

        expect(term).toBe('tr');
        expect(filters?.diameter_min_m).toBeCloseTo(0.2794, 4);
        expect(filters?.diameter_max_m).toBeCloseTo(0.3429, 4);
    });

    test('sem resultado com filtro avisa e "Limpar filtros" volta ao estado inicial', async () => {
        search.mockResolvedValue(listing([]));
        await open();

        await pickFilter('Fabricante', 'Alfa');

        expect(
            await screen.findByText(
                'Nenhum alto-falante com esses filtros.',
                undefined,
                {
                    timeout: 2000,
                },
            ),
        ).toBeVisible();

        await userEvent.click(
            screen.getByRole('button', { name: 'Limpar filtros' }),
        );

        expect(
            screen.queryByRole('button', { name: 'Limpar filtros' }),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText('Nenhum alto-falante com esses filtros.'),
        ).not.toBeInTheDocument();
    });

    test('offline os filtros somem', async () => {
        await open({ disabled: true });

        expect(screen.queryByText('Diâmetro')).not.toBeInTheDocument();
    });

    test('mostra a miniatura da capa no resultado do catálogo, decorativa', async () => {
        search.mockResolvedValue(
            listing([
                {
                    ...SUMMARY,
                    cover_thumb_url:
                        'https://x.test/storage/driver-images/a_thumb.webp',
                },
            ]),
        );
        const input = await open();

        const option = await typeAndWait(input);

        const image = option.querySelector('img');
        expect(image).toHaveAttribute(
            'src',
            'https://x.test/storage/driver-images/a_thumb.webp',
        );
        expect(image).toHaveAttribute('alt', '');
        expect(option).toHaveAccessibleName(/^Triton TR 620 12" \(4 Ω\)/);
    });

    test('os recentes também mostram a miniatura da capa', async () => {
        useRecentDrivers.setState({
            items: [
                {
                    id: SUMMARY.id,
                    brand: 'Triton',
                    model: 'TR 620',
                    fs_hz: 40,
                    qts: 0.4,
                    vas_m3: 0.05,
                    cover_thumb_url: 'https://x.test/recente_thumb.webp',
                },
            ],
        });
        await open();

        const option = screen.getByRole('option', { name: /Triton TR 620/ });

        expect(option.querySelector('img')).toHaveAttribute(
            'src',
            'https://x.test/recente_thumb.webp',
        );
    });

    test('escolher um driver com capa guarda a miniatura nos recentes', async () => {
        search.mockResolvedValue(
            listing([
                { ...SUMMARY, cover_thumb_url: 'https://x.test/c_thumb.webp' },
            ]),
        );
        const input = await open();

        await userEvent.click(await typeAndWait(input));

        await waitFor(() =>
            expect(useRecentDrivers.getState().items[0]).toMatchObject({
                cover_thumb_url: 'https://x.test/c_thumb.webp',
            }),
        );
    });

    test('sem imagem mostra o espaço reservado, sem <img>', async () => {
        const input = await open();

        const option = await typeAndWait(input);

        expect(option.querySelector('img')).toBeNull();
        expect(
            within(option).getByTestId('driver-thumb-placeholder'),
        ).toBeInTheDocument();
    });

    test('imagem que não carrega vira o espaço reservado e a lista segue funcionando', async () => {
        search.mockResolvedValue(
            listing([
                { ...SUMMARY, cover_thumb_url: 'https://x.test/quebrada.webp' },
            ]),
        );
        const input = await open();
        const option = await typeAndWait(input);

        const image = option.querySelector('img');
        expect(image).not.toBeNull();
        act(() => {
            image?.dispatchEvent(new Event('error'));
        });

        expect(option.querySelector('img')).toBeNull();
        expect(
            within(option).getByTestId('driver-thumb-placeholder'),
        ).toBeInTheDocument();
        expect(option).toHaveTextContent('Triton TR 620 12"');
    });
});
