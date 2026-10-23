import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { extractManual } from '@/lib/submission/manual-client';
import type { ManualFillResult } from '@/lib/submission/manual-client';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import SubmitDriverDialog from './submit-driver-dialog';

vi.mock('@/lib/submission/manual-client', async (importOriginal) => ({
    ...(await importOriginal<
        typeof import('@/lib/submission/manual-client')
    >()),
    extractManual: vi.fn(),
}));

vi.mock('@/lib/submission/client', () => ({ submitDriver: vi.fn() }));

const connection = vi.hoisted(() => ({
    status: 'online' as 'online' | 'offline',
}));

vi.mock('@/hooks/use-online-status', () => ({
    useOnlineStatus: () => connection.status,
}));

const extract = vi.mocked(extractManual);

const FILLED: ManualFillResult = {
    ok: true,
    result: {
        suggestion: {
            brand: 'Triton',
            model: 'TR 620',
            type: 'woofer',
            numbers: { fs_hz: 76.94, qts: 0.9, qes: 0.779, qms: 8.978 },
        },
        suspect: ['qts', 'qes', 'qms'],
        discarded: ['vas_m3'],
        warnings: ['review'],
    },
};

const user = userEvent.setup({ applyAccept: false });

function pdf(name = 'ficha.pdf', size?: number) {
    const file = new File(['%PDF-1.4'], name, { type: 'application/pdf' });

    if (size !== undefined) {
        Object.defineProperty(file, 'size', { value: size });
    }

    return file;
}

function render() {
    renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);
}

async function attach(file: File) {
    const input =
        document.querySelector<HTMLInputElement>('input[type="file"]');

    if (input === null) {
        throw new Error('campo de arquivo não encontrado');
    }

    await user.upload(input, file);
}

function fillButton() {
    return screen.getByRole('button', {
        name: /Preencher a partir do manual|Lendo o manual/,
    });
}

function field(label: RegExp | string) {
    return screen.getByRole('textbox', { name: label });
}

// Os campos numéricos mostram a precisão da grandeza (Fs com 1 casa, Qts com 2…).
function valueOf(label: RegExp): string {
    return (field(label) as HTMLInputElement).value;
}

beforeEach(() => {
    localStorage.clear();
    useWorkspace.setState(initialWorkspace());
    usePreferences.setState({ unitSystem: 'metric', locale: 'pt-BR' });
    connection.status = 'online';
    extract.mockReset();
    extract.mockResolvedValue(FILLED);
});

describe('ManualFill — preencher a partir do manual (US1)', () => {
    test('o botão só liga com um PDF escolhido e mostra o aviso de privacidade', async () => {
        render();

        expect(fillButton()).toBeDisabled();
        expect(
            screen.getByText(/enviado a um serviço de IA externo/),
        ).toBeInTheDocument();

        await attach(pdf());

        expect(fillButton()).toBeEnabled();
        expect(screen.getByText('ficha.pdf')).toBeInTheDocument();
    });

    test('arquivo que não é PDF ou passa de 10 MB é recusado no cliente, sem chamar o servidor', async () => {
        render();

        await attach(new File(['x'], 'foto.png', { type: 'image/png' }));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'O arquivo precisa ser um PDF.',
        );
        expect(fillButton()).toBeDisabled();

        await attach(pdf('grande.pdf', 11 * 1024 * 1024));
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'O PDF passa de 10 MB.',
        );
        expect(fillButton()).toBeDisabled();
        expect(extract).not.toHaveBeenCalled();
    });

    test('remover tira o arquivo e desliga o botão', async () => {
        render();
        await attach(pdf());

        await user.click(screen.getByRole('button', { name: /Remover/ }));

        expect(screen.queryByText('ficha.pdf')).not.toBeInTheDocument();
        expect(fillButton()).toBeDisabled();
    });

    test('preenche os campos vazios, mostra o resumo e não envia nada ao catálogo', async () => {
        render();
        await attach(pdf());
        await user.click(fillButton());

        await waitFor(() => expect(field(/Fabricante/)).toHaveValue('Triton'));
        expect(field(/Modelo/)).toHaveValue('TR 620');
        expect(valueOf(/^Fs/)).toMatch(/^76,9/);
        expect(
            screen.getByText(/campos preenchidos a partir/),
        ).toBeInTheDocument();
        expect(extract).toHaveBeenCalledTimes(1);
        expect(extract.mock.calls[0][1]).toMatchObject({
            locale: 'pt-BR',
            trap: '',
        });
    });

    test('mantém o que a pessoa já digitou', async () => {
        render();
        await user.click(field(/Fabricante/));
        await user.paste('Minha marca');

        await attach(pdf());
        await user.click(fillButton());

        await waitFor(() => expect(field(/Modelo/)).toHaveValue('TR 620'));
        expect(field(/Fabricante/)).toHaveValue('Minha marca');
    });

    test('um pedido por vez enquanto lê', async () => {
        let finish: (result: ManualFillResult) => void = () => undefined;
        extract.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );
        render();
        await attach(pdf());

        await user.click(fillButton());

        await waitFor(() =>
            expect(fillButton()).toHaveTextContent('Lendo o manual…'),
        );
        expect(fillButton()).toBeDisabled();
        expect(extract).toHaveBeenCalledTimes(1);

        finish(FILLED);
        await waitFor(() => expect(field(/Modelo/)).toHaveValue('TR 620'));
    });

    test('offline desativa o bloco com o aviso', async () => {
        connection.status = 'offline';
        render();

        expect(
            screen.getByText(/leitura do manual precisa do servidor/),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Escolher PDF…' }),
        ).toBeDisabled();
    });
});

describe('ManualFill — revisar com apoio (US2)', () => {
    test('destaca os suspeitos, lista descartados e lembra de revisar', async () => {
        render();
        await attach(pdf());
        await user.click(fillButton());

        await waitFor(() => expect(valueOf(/^Fs/)).toMatch(/^76,9/));

        expect(
            screen.getAllByText(
                'Confira no manual: este valor não bate com os demais.',
            ),
        ).toHaveLength(3);
        expect(
            screen.getByText(
                'Dados lidos automaticamente. Revise antes de enviar.',
            ),
        ).toBeInTheDocument();
        expect(screen.getByText(/deixados em branco: Vas/)).toBeInTheDocument();
    });

    test('editar um campo suspeito tira só o destaque dele', async () => {
        render();
        await attach(pdf());
        await user.click(fillButton());
        await waitFor(() => expect(valueOf(/^Qts/)).toMatch(/^0,9/));

        await user.tripleClick(field(/^Qts/));
        await user.paste('0,72');
        await user.tab();

        expect(valueOf(/^Qts/)).toMatch(/^0,72/);
        await waitFor(() =>
            expect(
                screen.getAllByText(
                    'Confira no manual: este valor não bate com os demais.',
                ),
            ).toHaveLength(2),
        );
    });

    test.each([
        ['multiple_drivers', /mais de um driver; usamos o primeiro/],
        ['nothing_found', /não encontramos parâmetros/i],
    ] as const)('aviso %s aparece sem bloquear', async (warning, text) => {
        extract.mockResolvedValue({
            ok: true,
            result: {
                suggestion: { numbers: {} },
                suspect: [],
                discarded: [],
                warnings: ['review', warning],
            },
        });
        render();
        await attach(pdf());
        await user.click(fillButton());

        expect(await screen.findByText(text)).toBeInTheDocument();
        expect(
            screen.getByText(/Nenhum campo vazio foi preenchido/),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
    });
});

describe('ManualFill — falhas nunca bloqueiam o envio (US3)', () => {
    test.each([
        ['unreadable', /não tem texto que possa ser lido/],
        ['invalidFile', /até 10 MB e 30 páginas/],
        ['providerFailed', /Não conseguimos ler o manual agora/],
        ['network', /Sem conexão com o servidor/],
        ['server', /servidor não conseguiu ler o manual/],
        ['verification', /não é um robô/],
    ] as const)(
        '%s mostra a mensagem e mantém o formulário',
        async (error, message) => {
            extract.mockResolvedValue({ ok: false, error });
            render();
            await user.click(field(/Fabricante/));
            await user.paste('Minha marca');
            await attach(pdf());
            await user.click(fillButton());

            expect(await screen.findByRole('alert')).toHaveTextContent(message);
            expect(field(/Fabricante/)).toHaveValue('Minha marca');
            expect(
                screen.getByRole('button', { name: 'Enviar' }),
            ).toBeEnabled();
            expect(fillButton()).toBeEnabled();
        },
    );

    test('limite por hora mostra os minutos do Retry-After', async () => {
        extract.mockResolvedValue({
            ok: false,
            error: 'rateLimited',
            retryAfterS: 1800,
        });
        render();
        await attach(pdf());
        await user.click(fillButton());

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Tente de novo em 30 min.',
        );
    });

    test('indisponível trava o botão do manual até fechar, sem tocar no resto', async () => {
        extract.mockResolvedValue({ ok: false, error: 'unavailable' });
        render();
        await attach(pdf());
        await user.click(fillButton());

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'O preenchimento por manual está indisponível agora.',
        );
        expect(fillButton()).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
        expect(field(/Fabricante/)).toBeEnabled();
    });
});
