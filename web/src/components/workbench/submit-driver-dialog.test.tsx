import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { submitDriver } from '@/lib/submission/client';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import SubmitDriverDialog from './submit-driver-dialog';

vi.mock('@/lib/submission/client', () => ({ submitDriver: vi.fn() }));

// O estado real de conexão sonda a API em segundo plano e, sem servidor na jsdom, passa a offline
// no meio da suíte. Os testes controlam o estado.
const connection = vi.hoisted(() => ({
    status: 'online' as 'online' | 'offline',
}));

vi.mock('@/hooks/use-online-status', () => ({
    useOnlineStatus: () => connection.status,
}));

const submit = vi.mocked(submitDriver);
const PROTOCOL = '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10';

function fill(label: RegExp | string) {
    return screen.getByRole('textbox', { name: label });
}

beforeEach(() => {
    localStorage.clear();
    useWorkspace.setState(initialWorkspace());
    usePreferences.setState({ unitSystem: 'metric', locale: 'pt-BR' });
    connection.status = 'online';
    submit.mockReset();
    submit.mockResolvedValue({ ok: true, protocol: PROTOCOL });
});

// Colar é um evento só; digitar caractere a caractere renderiza o formulário inteiro a cada tecla.
async function paste(label: RegExp, text: string) {
    await userEvent.click(fill(label));
    await userEvent.paste(text);
}

function seedDriver() {
    const store = activeProjectStore().getState();
    store.setDriverValue('fs_hz', 34.5);
    store.setDriverValue('qts', 0.41);
    store.setDriverValue('vas_m3', 0.085);
}

describe('SubmitDriverDialog — enviar o driver do projeto (US1)', () => {
    test('abre com os parâmetros do projeto na unidade exibida e a identificação em branco', () => {
        seedDriver();
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        expect(fill(/^Fs/)).toHaveValue('34,5');
        expect(fill(/^Vas/)).toHaveValue('85,0');
        expect(fill(/Fabricante/)).toHaveValue('');
        expect(fill(/Fonte dos dados/)).toHaveValue('');
    });

    test('a origem do driver pré-preenche fabricante e modelo', () => {
        seedDriver();
        activeProjectStore()
            .getState()
            .apply((data) => ({
                ...data,
                driverSource: {
                    brand: 'Triton',
                    model: 'TR 620',
                    variant: '4 Ω',
                },
            }));
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        expect(fill(/Fabricante/)).toHaveValue('Triton');
        expect(fill(/Modelo/)).toHaveValue('TR 620');
        expect(fill(/Variante/)).toHaveValue('4 Ω');
    });

    test('campo obrigatório vazio mostra o erro, não chama a API e mantém o digitado', async () => {
        seedDriver();
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        await paste(/Fabricante/, 'Exemplo');
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        expect(submit).not.toHaveBeenCalled();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            /Corrija \d+ campos? antes de enviar/,
        );
        expect(fill(/Fabricante/)).toHaveValue('Exemplo');
    });

    test('envio válido mostra a confirmação com protocolo e não altera o projeto', async () => {
        seedDriver();
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);
        const before = structuredClone(activeProjectStore().getState().data);

        await paste(/Fabricante/, 'Exemplo');
        await paste(/Modelo/, 'EX-1');
        await paste(/Fonte dos dados/, 'Ficha técnica');
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        expect(await screen.findByText(PROTOCOL)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Copiar protocolo' }),
        ).toBeInTheDocument();
        expect(screen.getByText(/passa por revisão/)).toBeInTheDocument();
        expect(submit).toHaveBeenCalledTimes(1);
        expect(submit.mock.calls[0][0]).toMatchObject({
            brand: 'Exemplo',
            model: 'EX-1',
            source: 'Ficha técnica',
            fs_hz: 34.5,
            qts: 0.41,
            vas_m3: 0.085,
            locale: 'pt-BR',
            website: '',
        });
        expect(activeProjectStore().getState().data).toEqual(before);
    });

    test('fechar sem alterações não pergunta nem envia', async () => {
        seedDriver();
        const onClose = vi.fn();
        renderWithProviders(<SubmitDriverDialog onClose={onClose} />);

        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(submit).not.toHaveBeenCalled();
    });

    test('fechar com alterações pede confirmação antes de descartar', async () => {
        seedDriver();
        const onClose = vi.fn();
        renderWithProviders(<SubmitDriverDialog onClose={onClose} />);

        await paste(/Fabricante/, 'Exemplo');
        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('alertdialog')).toHaveTextContent(
            'Descartar o envio?',
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Descartar envio' }),
        );
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(submit).not.toHaveBeenCalled();
    });

    test('o campo-armadilha não é alcançável pelo teclado nem anunciado', () => {
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        const trap = document.querySelector('input[name="website"]');

        expect(trap).toHaveAttribute('tabindex', '-1');
        expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    });
});

async function sendValidForm() {
    await paste(/Fabricante/, 'Exemplo');
    await paste(/Modelo/, 'EX-1');
    await paste(/Fonte dos dados/, 'Ficha técnica');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
}

describe('SubmitDriverDialog — recusas do servidor (US3)', () => {
    test.each([
        ['alreadyInCatalog', /já está no catálogo/],
        ['alreadyPending', /já está em análise/],
        ['verification', /não é um robô/],
    ] as const)(
        '%s mostra a mensagem e preserva o formulário',
        async (error, message) => {
            seedDriver();
            submit.mockResolvedValue({ ok: false, error });
            renderWithProviders(
                <SubmitDriverDialog onClose={() => undefined} />,
            );

            await sendValidForm();

            expect(await screen.findByRole('alert')).toHaveTextContent(message);
            expect(fill(/Fabricante/)).toHaveValue('Exemplo');
            expect(fill(/^Fs/)).toHaveValue('34,5');
        },
    );

    test('limite de envios mostra os minutos do Retry-After', async () => {
        seedDriver();
        submit.mockResolvedValue({
            ok: false,
            error: 'rateLimited',
            retryAfterS: 1800,
        });
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        await sendValidForm();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Tente de novo em 30 min',
        );
    });

    test('limite sem Retry-After pede para tentar mais tarde', async () => {
        seedDriver();
        submit.mockResolvedValue({ ok: false, error: 'rateLimited' });
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        await sendValidForm();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Tente mais tarde',
        );
    });

    test('verificação reprovada oferece tentar de novo e o reenvio funciona', async () => {
        seedDriver();
        submit.mockResolvedValueOnce({ ok: false, error: 'verification' });
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        await sendValidForm();
        await userEvent.click(
            await screen.findByRole('button', { name: 'Tentar de novo' }),
        );

        expect(await screen.findByText(PROTOCOL)).toBeInTheDocument();
        expect(submit).toHaveBeenCalledTimes(2);
    });

    test('duplicata não oferece tentar de novo (reenviar não resolve)', async () => {
        seedDriver();
        submit.mockResolvedValue({ ok: false, error: 'alreadyInCatalog' });
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        await sendValidForm();
        await screen.findByRole('alert');

        expect(
            screen.queryByRole('button', { name: 'Tentar de novo' }),
        ).not.toBeInTheDocument();
    });

    test('o campo-armadilha preenchido segue no corpo para o servidor decidir', async () => {
        seedDriver();
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);
        const trap = document.querySelector<HTMLInputElement>(
            'input[name="website"]',
        );

        await paste(/Fabricante/, 'Exemplo');
        await paste(/Modelo/, 'EX-1');
        await paste(/Fonte dos dados/, 'Ficha');
        if (trap !== null) {
            await userEvent.type(trap, 'robo', { pointerEventsCheck: 0 });
        }
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        await screen.findByText(PROTOCOL);
        expect(submit.mock.calls[0][0].website).toBe('robo');
    });
});

describe('SubmitDriverDialog — sem projeto e falhas (US4)', () => {
    test('projeto sem driver abre com os campos vazios e aceita preenchimento à mão', async () => {
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        expect(fill(/^Fs/)).toHaveValue('');
        expect(fill(/^Qts/)).toHaveValue('');
        expect(fill(/^Vas/)).toHaveValue('');

        await paste(/^Fs/, '40');
        await paste(/^Qts/, '0,4');
        await paste(/^Vas/, '50');
        await userEvent.tab();
        await sendValidForm();

        expect(await screen.findByText(PROTOCOL)).toBeInTheDocument();
        expect(submit.mock.calls[0][0]).toMatchObject({
            fs_hz: 40,
            qts: 0.4,
            vas_m3: 0.05,
        });
    });

    test('vazio, os três obrigatórios são apontados e nada é enviado', async () => {
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        expect(submit).not.toHaveBeenCalled();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Corrija 6 campos antes de enviar.',
        );
    });

    test.each([
        ['network', /Sem conexão com o servidor/],
        ['server', /não conseguiu receber/],
    ] as const)(
        '%s mostra a mensagem, mantém o digitado e o reenvio funciona',
        async (error, message) => {
            seedDriver();
            submit.mockResolvedValueOnce({ ok: false, error });
            renderWithProviders(
                <SubmitDriverDialog onClose={() => undefined} />,
            );

            await sendValidForm();

            expect(await screen.findByRole('alert')).toHaveTextContent(message);
            expect(fill(/Fabricante/)).toHaveValue('Exemplo');
            expect(fill(/^Fs/)).toHaveValue('34,5');

            await userEvent.click(
                screen.getByRole('button', { name: 'Tentar de novo' }),
            );

            expect(await screen.findByText(PROTOCOL)).toBeInTheDocument();
            expect(submit).toHaveBeenCalledTimes(2);
            expect(submit.mock.calls[1][0]).toEqual(submit.mock.calls[0][0]);
        },
    );

    test('offline desativa o envio com o motivo visível e reativa ao voltar', async () => {
        seedDriver();
        connection.status = 'offline';
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        const send = screen.getByRole('button', { name: 'Enviar' });
        expect(send).toBeDisabled();
        expect(
            screen.getByText('Sem conexão: o envio precisa do servidor.'),
        ).toBeVisible();
        const reason = screen.getByText(
            'Sem conexão: o envio precisa do servidor.',
        );
        expect(send).toHaveAttribute('aria-describedby', reason.id);
        // O digitado fica: dá para continuar preenchendo offline.
        await paste(/Fabricante/, 'Exemplo');
        expect(fill(/Fabricante/)).toHaveValue('Exemplo');

        connection.status = 'online';
        await paste(/Modelo/, 'EX-1');

        expect(screen.getByRole('button', { name: 'Enviar' })).toBeEnabled();
        expect(
            screen.queryByText('Sem conexão: o envio precisa do servidor.'),
        ).not.toBeInTheDocument();
    });

    test('offline não envia nem com Enter no formulário', async () => {
        seedDriver();
        connection.status = 'offline';
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        await paste(/Fabricante/, 'Exemplo');
        await paste(/Modelo/, 'EX-1');
        await paste(/Fonte dos dados/, 'Ficha');
        await userEvent.keyboard('{Enter}');

        expect(submit).not.toHaveBeenCalled();
    });
});
