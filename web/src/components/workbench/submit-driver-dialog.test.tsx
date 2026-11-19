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

// O formulário é grande (quatro etapas); na suíte completa, em paralelo, passa dos 5 s padrão.
vi.setConfig({ testTimeout: 20_000 });

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

// Abre o diálogo e escolhe o caminho; por padrão, preencher os campos à mão.
async function open(
    onClose: () => void = () => undefined,
    path = /Digitar os parâmetros/,
) {
    renderWithProviders(<SubmitDriverDialog onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: path }));
}

async function fillDriver() {
    await paste(/^Fs/, '34,5');
    await paste(/^Qts/, '0,41');
    await paste(/^Vas/, '85');
    await userEvent.tab();
}

describe('SubmitDriverDialog — enviar o driver do projeto', () => {
    test('abre na escolha e os campos começam vazios, mesmo com driver no projeto', async () => {
        const store = activeProjectStore().getState();
        store.setDriverValue('fs_hz', 34.5);
        store.setDriverValue('vas_m3', 0.085);
        renderWithProviders(<SubmitDriverDialog onClose={() => undefined} />);

        expect(screen.queryByRole('textbox', { name: /^Fs/ })).toBeNull();
        await userEvent.click(
            screen.getByRole('button', { name: /Digitar os parâmetros/ }),
        );

        expect(fill(/^Fs/)).toHaveValue('');
        expect(fill(/^Vas/)).toHaveValue('');
        expect(fill(/Fabricante/)).toHaveValue('');
        expect(screen.queryByText(/Preencher a partir do manual/)).toBeNull();
    });

    test('anexar o manual mostra só o anexo; voltar retorna à escolha', async () => {
        await open(undefined, /Anexar o manual/);

        expect(
            screen.getAllByText(/Preencher a partir do manual/)[0],
        ).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: /^Fs/ })).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Voltar' }));
        expect(
            screen.getByRole('button', { name: /Digitar os parâmetros/ }),
        ).toBeInTheDocument();
    });

    test('cancelar na escolha fecha sem enviar', async () => {
        const onClose = vi.fn();
        renderWithProviders(<SubmitDriverDialog onClose={onClose} />);

        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(submit).not.toHaveBeenCalled();
    });

    test('campo obrigatório vazio mostra o erro, não chama a API e mantém o digitado', async () => {
        await open();
        await fillDriver();

        await paste(/Fabricante/, 'Exemplo');
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        expect(submit).not.toHaveBeenCalled();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            /Corrija \d+ campos? antes de enviar/,
        );
        expect(fill(/Fabricante/)).toHaveValue('Exemplo');
    });

    test('envio válido mostra a confirmação com protocolo e não altera o projeto', async () => {
        await open();
        await fillDriver();
        const before = structuredClone(activeProjectStore().getState().data);

        await paste(/Fabricante/, 'Exemplo');
        await paste(/Modelo/, 'EX-1');
        await paste(/Fonte dos dados/, 'Ficha técnica');
        await paste(/E-mail/, 'pessoa@exemplo.com');
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        expect(await screen.findByText(PROTOCOL)).toBeInTheDocument();
        expect(screen.getByText(/avisar por e-mail/)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Copiar protocolo' }),
        ).toBeInTheDocument();
        expect(screen.getByText(/passa por revisão/)).toBeInTheDocument();
        expect(submit).toHaveBeenCalledTimes(1);
        expect(submit.mock.calls[0][0]).toMatchObject({
            brand: 'Exemplo',
            model: 'EX-1',
            source: 'Ficha técnica',
            contact_email: 'pessoa@exemplo.com',
            fs_hz: 34.5,
            qts: 0.41,
            vas_m3: 0.085,
            locale: 'pt-BR',
            website: '',
        });
        expect(activeProjectStore().getState().data).toEqual(before);
    });

    test('o e-mail é obrigatório: vazio ou inválido não envia e aponta o campo', async () => {
        await open();
        await fillDriver();

        await paste(/Fabricante/, 'Exemplo');
        await paste(/Modelo/, 'EX-1');
        await paste(/Fonte dos dados/, 'Ficha técnica');
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        expect(submit).not.toHaveBeenCalled();
        expect(screen.getByText('Preencha este campo.')).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Origem e contato' }),
        ).toBeInTheDocument();

        await paste(/E-mail/, 'sem-arroba');
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        expect(submit).not.toHaveBeenCalled();
        expect(
            screen.getByText('Informe um e-mail válido.'),
        ).toBeInTheDocument();
    });

    test('fechar sem alterações não pergunta nem envia', async () => {
        const onClose = vi.fn();
        await open(onClose);

        await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(submit).not.toHaveBeenCalled();
    });

    test('fechar com alterações pede confirmação antes de descartar', async () => {
        const onClose = vi.fn();
        await open(onClose);
        await fillDriver();

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

    test('o campo-armadilha não é alcançável pelo teclado nem anunciado', async () => {
        await open();

        const trap = document.querySelector('input[name="website"]');

        expect(trap).toHaveAttribute('tabindex', '-1');
        expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    });
});

async function sendValidForm() {
    await paste(/Fabricante/, 'Exemplo');
    await paste(/Modelo/, 'EX-1');
    await paste(/Fonte dos dados/, 'Ficha técnica');
    await paste(/E-mail/, 'pessoa@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));
}

describe('SubmitDriverDialog — recusas do servidor', () => {
    test.each([
        ['alreadyInCatalog', /já está no catálogo/],
        ['alreadyPending', /já está em análise/],
        ['verification', /não é um robô/],
    ] as const)(
        '%s mostra a mensagem e preserva o formulário',
        async (error, message) => {
            submit.mockResolvedValue({ ok: false, error });
            await open();
            await fillDriver();

            await sendValidForm();

            expect(await screen.findByRole('alert')).toHaveTextContent(message);
            expect(fill(/Fabricante/)).toHaveValue('Exemplo');
            expect(fill(/^Fs/)).toHaveValue('34,5');
        },
    );

    test('limite de envios mostra os minutos do Retry-After', async () => {
        submit.mockResolvedValue({
            ok: false,
            error: 'rateLimited',
            retryAfterS: 1800,
        });
        await open();
        await fillDriver();

        await sendValidForm();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Tente de novo em 30 min',
        );
    });

    test('limite sem Retry-After pede para tentar mais tarde', async () => {
        submit.mockResolvedValue({ ok: false, error: 'rateLimited' });
        await open();
        await fillDriver();

        await sendValidForm();

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Tente mais tarde',
        );
    });

    test('verificação reprovada oferece tentar de novo e o reenvio funciona', async () => {
        submit.mockResolvedValueOnce({ ok: false, error: 'verification' });
        await open();
        await fillDriver();

        await sendValidForm();
        await userEvent.click(
            await screen.findByRole('button', { name: 'Tentar de novo' }),
        );

        expect(await screen.findByText(PROTOCOL)).toBeInTheDocument();
        expect(submit).toHaveBeenCalledTimes(2);
    });

    test('duplicata não oferece tentar de novo (reenviar não resolve)', async () => {
        submit.mockResolvedValue({ ok: false, error: 'alreadyInCatalog' });
        await open();
        await fillDriver();

        await sendValidForm();
        await screen.findByRole('alert');

        expect(
            screen.queryByRole('button', { name: 'Tentar de novo' }),
        ).not.toBeInTheDocument();
    });

    test('o campo-armadilha preenchido segue no corpo para o servidor decidir', async () => {
        await open();
        await fillDriver();
        const trap = document.querySelector<HTMLInputElement>(
            'input[name="website"]',
        );

        await paste(/Fabricante/, 'Exemplo');
        await paste(/Modelo/, 'EX-1');
        await paste(/Fonte dos dados/, 'Ficha');
        await paste(/E-mail/, 'pessoa@exemplo.com');
        if (trap !== null) {
            await userEvent.type(trap, 'robo', { pointerEventsCheck: 0 });
        }
        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        await screen.findByText(PROTOCOL);
        expect(submit.mock.calls[0][0].website).toBe('robo');
    });
});

describe('SubmitDriverDialog — campos calculados dos outros', () => {
    test('Qes e Qms inserem o Qts no campo, marcado como calculado e editável', async () => {
        await open();

        await userEvent.click(
            screen.getByRole('button', { name: /Opcionais/ }),
        );
        await paste(/^Qes/, '0,44');
        await paste(/^Qms/, '8,37');
        await userEvent.tab();

        expect(fill(/^Qts/)).toHaveValue('0,42');
        expect(screen.getByText('calculado')).toBeInTheDocument();

        await userEvent.tripleClick(fill(/^Qts/));
        await userEvent.keyboard('0,5');
        await userEvent.tab();

        expect(fill(/^Qts/)).toHaveValue('0,50');
        expect(screen.queryByText('calculado')).not.toBeInTheDocument();
    });

    test('o valor calculado vai no envio, como se tivesse sido digitado', async () => {
        await open();

        await userEvent.click(
            screen.getByRole('button', { name: /Opcionais/ }),
        );
        await paste(/^Fs/, '40');
        await paste(/^Vas/, '50');
        await paste(/^Qes/, '0,44');
        await paste(/^Qms/, '8,37');
        await userEvent.tab();
        await sendValidForm();

        expect(await screen.findByText(PROTOCOL)).toBeInTheDocument();
        expect(submit.mock.calls[0][0]).toMatchObject({ qts: 0.418 });
    });
});

describe('SubmitDriverDialog — sem projeto e falhas', () => {
    test('projeto sem driver abre com os campos vazios e aceita preenchimento à mão', async () => {
        await open();

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

    test('vazio, os campos obrigatórios (com o e-mail) são apontados e nada é enviado', async () => {
        await open();

        await userEvent.click(screen.getByRole('button', { name: 'Enviar' }));

        expect(submit).not.toHaveBeenCalled();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Corrija 7 campos antes de enviar.',
        );
    });

    test.each([
        ['network', /Sem conexão com o servidor/],
        ['server', /não conseguiu receber/],
    ] as const)(
        '%s mostra a mensagem, mantém o digitado e o reenvio funciona',
        async (error, message) => {
            submit.mockResolvedValueOnce({ ok: false, error });
            await open();
            await fillDriver();

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
        connection.status = 'offline';
        await open();
        await fillDriver();

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
        connection.status = 'offline';
        await open();
        await fillDriver();

        await paste(/Fabricante/, 'Exemplo');
        await paste(/Modelo/, 'EX-1');
        await paste(/Fonte dos dados/, 'Ficha');
        await userEvent.keyboard('{Enter}');

        expect(submit).not.toHaveBeenCalled();
    });
});
