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

const submit = vi.mocked(submitDriver);
const PROTOCOL = '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10';

function fill(label: RegExp | string) {
    return screen.getByRole('textbox', { name: label });
}

beforeEach(() => {
    localStorage.clear();
    useWorkspace.setState(initialWorkspace());
    usePreferences.setState({ unitSystem: 'metric', locale: 'pt-BR' });
    submit.mockReset();
    submit.mockResolvedValue({ ok: true, protocol: PROTOCOL });
});

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

        await userEvent.type(fill(/Fabricante/), 'Exemplo');
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

        await userEvent.type(fill(/Fabricante/), 'Exemplo');
        await userEvent.type(fill(/Modelo/), 'EX-1');
        await userEvent.type(fill(/Fonte dos dados/), 'Ficha técnica');
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

        await userEvent.type(fill(/Fabricante/), 'Exemplo');
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
