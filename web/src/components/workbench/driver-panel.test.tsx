import { act, screen } from '@testing-library/react';
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

describe('DriverPanel — consistência e calculados (US4)', () => {
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
        expect(qts.closest('[class*="group"]')).toHaveTextContent('calculado');
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
                /Diferença de 10,2\s?% em Qts = Qes·Qms \/ \(Qes \+ Qms\)/,
            ),
        ).toHaveLength(3);
        expect(field('Qts')).toHaveClass('text-foreground');
    });
});

describe('DriverPanel — cabeçalho compacto (feature 008, US3)', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        connection.status = 'online';
    });

    test('sem campo de busca fixo: só o botão "Buscar driver" e o ícone de enviar', () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Buscar driver' }),
        ).toBeInTheDocument();
        const send = screen.getByRole('button', { name: 'Enviar driver' });
        expect(send).toHaveTextContent('');
    });

    test('offline, a busca continua abrindo e o campo segue ativo para os salvos', async () => {
        connection.status = 'offline';
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Buscar driver' }),
        );

        expect(screen.getByRole('searchbox')).toBeEnabled();
    });
});

describe('DriverPanel — enviar driver (specs/006, US4)', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        connection.status = 'online';
    });

    test('online, o botão chama o envio', async () => {
        const onSubmitDriver = vi.fn();
        renderWithProviders(<DriverPanel onSubmitDriver={onSubmitDriver} />);

        await userEvent.click(
            screen.getByRole('button', { name: /Enviar driver/ }),
        );

        expect(onSubmitDriver).toHaveBeenCalledTimes(1);
    });

    test('offline, o botão fica desativado e não chama o envio', async () => {
        connection.status = 'offline';
        const onSubmitDriver = vi.fn();
        renderWithProviders(<DriverPanel onSubmitDriver={onSubmitDriver} />);
        const button = screen.getByRole('button', { name: /Enviar driver/ });

        expect(button).toBeDisabled();

        await userEvent.click(button);
        expect(onSubmitDriver).not.toHaveBeenCalled();
    });
});

describe('DriverPanel — alto-falantes salvos (specs/008, US6)', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        useSavedDrivers.setState({ items: [] });
        connection.status = 'online';
    });

    test('salvar fica desativado sem parâmetros e funciona offline', async () => {
        connection.status = 'offline';
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        const save = screen.getByRole('button', {
            name: 'Salvar este alto-falante',
        });

        expect(save).toBeDisabled();

        act(() => activeProjectStore().getState().setDriverValue('fs_hz', 32));

        expect(save).toBeEnabled();
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

        await userEvent.click(
            screen.getByRole('button', { name: 'Salvar este alto-falante' }),
        );
        expect(
            await screen.findByRole('textbox', { name: /Marca/ }),
        ).toHaveValue('Triton');
        await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

        expect(useSavedDrivers.getState().items).toMatchObject([
            { brand: 'Triton', model: 'TR 620' },
        ]);
        expect(screen.getByText(/· salvo/)).toBeVisible();
    });

    test('"Meus alto-falantes" abre o gerenciamento', async () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Meus alto-falantes' }),
        );

        expect(
            await screen.findByRole('dialog', { name: 'Meus alto-falantes' }),
        ).toBeVisible();
    });
});
