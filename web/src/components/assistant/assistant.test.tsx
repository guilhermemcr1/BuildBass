import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { renderWithProviders } from '@/test/render';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import Assistant from './assistant';

vi.mock('@/hooks/use-online-status', () => ({
    useOnlineStatus: () => 'online',
}));

function typeMinimum() {
    act(() => {
        const { setDriverValue } = activeProjectStore().getState();
        setDriverValue('fs_hz', 30);
        setDriverValue('qts', 0.4);
        setDriverValue('vas_m3', 0.06);
    });
}

describe('Assistente', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        // O catálogo não importa aqui: responde vazio.
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ data: [], meta: {} }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }),
            ),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('só avança do alto-falante com Fs, Qts e Vas', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Assistant onClose={() => undefined} />);

        const next = screen.getByRole('button', { name: /Avançar/ });
        expect(next).toBeDisabled();
        expect(
            screen.getByText(
                'Escolha um alto-falante do catálogo ou outra forma de preencher.',
            ),
        ).toBeInTheDocument();
        // Abre no catálogo, com as alternativas à vista.
        expect(
            screen.getByRole('searchbox', { name: 'Buscar no catálogo' }),
        ).toBeInTheDocument();

        // Digitar vai direto para os dados.
        await user.click(screen.getByRole('button', { name: /^Digitar/ }));
        expect(
            screen.getByText(/Falta informar: Fs, Qts, Vas/),
        ).toBeInTheDocument();
        expect(next).toBeDisabled();

        typeMinimum();
        expect(next).toBeEnabled();

        await user.click(next);
        expect(
            screen.getByRole('heading', { name: 'Como vai ser a caixa?' }),
        ).toBeInTheDocument();
    });

    test('a caixa parte da sugestão clássica e leva à conferência', async () => {
        const user = userEvent.setup();
        typeMinimum();
        renderWithProviders(<Assistant onClose={() => undefined} />);

        // Com o alto-falante pronto, abre direto na caixa e semeia volume e sintonia.
        expect(activeProjectStore().getState().data.box.vb_m3).toBeGreaterThan(
            0,
        );
        expect(activeProjectStore().getState().data.box.fb_hz).toBeGreaterThan(
            0,
        );

        await user.click(screen.getByRole('button', { name: /Avançar/ }));

        expect(
            screen.getByRole('heading', { name: 'Confira o projeto' }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Confira cada valor com o manual/),
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Concluir' })).toBeEnabled();
    });

    test('texto colado mostra o que o filtro vai enviar e bloqueia sem parâmetro', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Assistant onClose={() => undefined} />);

        await user.click(screen.getByRole('button', { name: /^Colar texto/ }));
        const box = screen.getByRole('textbox', {
            name: 'Texto com os parâmetros',
        });
        const send = screen.getByRole('button', { name: /Preencher com IA/ });

        await user.type(box, 'Oi, tudo bem com você?');
        expect(
            screen.getByText(/Nenhuma linha com parâmetro/),
        ).toBeInTheDocument();
        expect(send).toBeDisabled();

        await user.clear(box);
        await user.type(
            box,
            'Fs 35 Hz{enter}Qts 0,4{enter}Vas 50 L{enter}compre já',
        );
        expect(
            screen.getByText(
                /3 linhas com parâmetros serão enviadas; 1 ignorada/,
            ),
        ).toBeInTheDocument();
        expect(send).toBeEnabled();
        expect(box).toHaveAttribute('maxlength', '4000');

        // Voltar leva de novo ao catálogo.
        await user.click(
            screen.getByRole('button', { name: 'Voltar ao catálogo' }),
        );
        expect(
            screen.getByRole('searchbox', { name: 'Buscar no catálogo' }),
        ).toBeInTheDocument();
    });

    test('sair chama onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        renderWithProviders(<Assistant onClose={onClose} />);

        await user.click(
            screen.getByRole('button', { name: 'Fechar assistente' }),
        );
        expect(onClose).toHaveBeenCalled();
    });
});
