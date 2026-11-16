import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { renderWithProviders } from '@/test/render';
import { useSavedDrivers } from '@/stores/saved-drivers';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { DriverPanel } from './driver-panel';

const connection = vi.hoisted(() => ({
    status: 'online' as 'online' | 'offline',
}));

vi.mock('@/hooks/use-online-status', () => ({
    useOnlineStatus: () => connection.status,
}));

function field(symbol: string) {
    return screen.getByRole('textbox', { name: new RegExp(`^${symbol}\\s?—`) });
}

describe('DriverPanel — consistência e calculados', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        connection.status = 'online';
    });

    test('Qes e Qms digitados mostram o Qts calculado, apagado', () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        act(() => {
            const { setDriverValue } = activeProjectStore().getState();
            setDriverValue('qes', 0.42);
            setDriverValue('qms', 4.1);
        });

        const qts = field('Qts');
        expect(qts).toHaveValue('0,38');
        expect(qts).toHaveClass('text-muted');
        expect(qts.closest('.group')).toHaveTextContent('calculado');
    });

    test('Qts divergente cita a relação e o percentual', () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        act(() => {
            const { setDriverValue } = activeProjectStore().getState();
            setDriverValue('qes', 0.42);
            setDriverValue('qms', 4.1);
            setDriverValue('qts', 0.42);
        });

        expect(
            screen.getAllByText(
                /Qts difere 10,2\s?% do valor calculado por Qes e Qms \(Qts = Qes·Qms \/ \(Qes \+ Qms\)\)/,
            ),
        ).toHaveLength(3);
        expect(field('Qts')).toHaveClass('text-foreground');
    });
});

// Salvar, "Meus alto-falantes" e enviar ficam no menu "⋯" ao lado de "Buscar alto-falante".
async function openActions() {
    await userEvent.click(
        screen.getByRole('button', { name: 'Mais ações do alto-falante' }),
    );
}

describe('DriverPanel — cabeçalho compacto', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        connection.status = 'online';
    });

    test('sem campo de busca fixo: só "Buscar alto-falante" e um menu com as demais ações', async () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /^Buscar alto-falante/ }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /Enviar alto-falante/ }),
        ).not.toBeInTheDocument();

        await openActions();

        expect(
            screen.getAllByRole('menuitem').map((item) => item.textContent),
        ).toEqual([
            'Salvar este alto-falante',
            'Meus alto-falantes',
            'Enviar alto-falante',
        ]);
    });

    test('offline, a busca continua abrindo e o campo segue ativo para os salvos', async () => {
        connection.status = 'offline';
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);

        await userEvent.click(
            screen.getByRole('button', { name: /^Buscar alto-falante/ }),
        );

        expect(screen.getByRole('searchbox')).toBeEnabled();
    });
});

describe('DriverPanel — enviar driver', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        connection.status = 'online';
    });

    test('online, o botão chama o envio', async () => {
        const onSubmitDriver = vi.fn();
        renderWithProviders(<DriverPanel onSubmitDriver={onSubmitDriver} />);

        await openActions();
        await userEvent.click(
            screen.getByRole('menuitem', { name: /Enviar alto-falante/ }),
        );

        expect(onSubmitDriver).toHaveBeenCalledTimes(1);
    });

    test('offline, o botão fica desativado e não chama o envio', async () => {
        connection.status = 'offline';
        const onSubmitDriver = vi.fn();
        renderWithProviders(<DriverPanel onSubmitDriver={onSubmitDriver} />);
        await openActions();
        const item = screen.getByRole('menuitem', {
            name: /Enviar alto-falante/,
        });

        expect(item).toHaveAttribute('aria-disabled', 'true');

        await userEvent.click(item);
        expect(onSubmitDriver).not.toHaveBeenCalled();
    });
});

describe('DriverPanel — alto-falantes salvos', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        useSavedDrivers.setState({ items: [] });
        connection.status = 'online';
    });

    test('salvar fica desativado sem parâmetros e funciona offline', async () => {
        connection.status = 'offline';
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        await openActions();

        expect(
            screen.getByRole('menuitem', { name: 'Salvar este alto-falante' }),
        ).toHaveAttribute('aria-disabled', 'true');

        act(() => activeProjectStore().getState().setDriverValue('fs_hz', 32));

        expect(
            screen.getByRole('menuitem', { name: 'Salvar este alto-falante' }),
        ).not.toHaveAttribute('aria-disabled');
    });

    test('abre o diálogo de salvar com a origem do driver e guarda na lista', async () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        act(() => {
            const state = activeProjectStore().getState();
            state.applyCatalogDriver(
                { fs_hz: 32, qts: 0.4, vas_m3: 0.1 },
                { brand: 'Triton', model: 'TR 620' },
            );
        });

        await openActions();
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Salvar este alto-falante' }),
        );
        const dialog = await screen.findByRole('dialog', {
            name: 'Salvar alto-falante',
        });
        expect(
            within(dialog).getByRole('textbox', { name: /Fabricante/ }),
        ).toHaveValue('Triton');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Salvar' }),
        );

        expect(useSavedDrivers.getState().items).toMatchObject([
            { brand: 'Triton', model: 'TR 620' },
        ]);
        expect(screen.getByText('Dos meus alto-falantes')).toBeVisible();
    });

    test('"Meus alto-falantes" abre o gerenciamento', async () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);

        await openActions();
        await userEvent.click(
            screen.getByRole('menuitem', { name: 'Meus alto-falantes' }),
        );

        expect(
            await screen.findByRole('dialog', { name: 'Meus alto-falantes' }),
        ).toBeVisible();
    });
});
