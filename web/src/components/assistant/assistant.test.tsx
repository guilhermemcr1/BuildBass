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

    test('só avança do alto-falante com Fs, Qts e Vas, e diz o que falta', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Assistant onClose={() => undefined} />);

        const next = screen.getByRole('button', { name: /Avançar/ });
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

        // Avançar sem o mínimo não muda de passo: lista o que falta e leva ao primeiro campo.
        await user.click(next);
        expect(screen.getByRole('alert')).toHaveTextContent(
            /Faltam 3 valores para seguir/,
        );
        expect(
            screen.getByRole('heading', {
                name: 'Qual alto-falante você vai usar?',
            }),
        ).toBeInTheDocument();
        expect(document.activeElement).toBe(
            screen.getByRole('textbox', { name: /^Fs/ }),
        );
        await user.click(
            screen.getByRole('button', { name: 'Ir ao campo Vas' }),
        );
        expect(document.activeElement).toBe(
            screen.getByRole('textbox', { name: /^Vas/ }),
        );

        typeMinimum();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

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

    test('ler um manual novo troca o alto-falante que já estava no projeto', async () => {
        const user = userEvent.setup();
        act(() => {
            const { setDriverValue } = activeProjectStore().getState();
            setDriverValue('fs_hz', 76.9);
            setDriverValue('qts', 0.72);
            setDriverValue('vas_m3', 0.026);
            setDriverValue('re_ohm', 3);
        });
        vi.stubGlobal(
            'fetch',
            vi.fn((input: RequestInfo | URL) =>
                Promise.resolve(
                    (input instanceof Request
                        ? input.url
                        : input.toString()
                    ).includes('/extract-text')
                        ? new Response(
                              JSON.stringify({
                                  data: {
                                      suggestion: {
                                          brand: 'Marca',
                                          model: 'SW12',
                                          fs_hz: 32,
                                          qts: 0.4,
                                          vas_m3: 0.06,
                                      },
                                      suspect: [],
                                      discarded: [],
                                      warnings: ['review'],
                                  },
                              }),
                              {
                                  status: 200,
                                  headers: {
                                      'Content-Type': 'application/json',
                                  },
                              },
                          )
                        : new Response(JSON.stringify({ data: [], meta: {} }), {
                              status: 200,
                              headers: {
                                  'Content-Type': 'application/json',
                              },
                          }),
                ),
            ),
        );
        renderWithProviders(<Assistant onClose={() => undefined} />);

        // Com dados no projeto, o passo abre na conferência; volta ao catálogo e cola o texto.
        await user.click(screen.getByRole('button', { name: /^Alto-falante/ }));
        await user.click(
            screen.getByRole('button', { name: 'Voltar ao catálogo' }),
        );
        await user.click(screen.getByRole('button', { name: /^Colar texto/ }));
        await user.type(
            screen.getByRole('textbox', { name: 'Texto com os parâmetros' }),
            'Fs 32 Hz{enter}Qts 0,4{enter}Vas 60 L',
        );
        await user.click(
            screen.getByRole('button', { name: /Preencher com IA/ }),
        );

        expect(
            await screen.findByText(/3 campos preenchidos pela IA/),
        ).toBeInTheDocument();
        const { data } = activeProjectStore().getState();
        expect(data.driver).toEqual({ fs_hz: 32, qts: 0.4, vas_m3: 0.06 });
        expect(data.driverSource).toEqual({ brand: 'Marca', model: 'SW12' });
    });

    test('PDF válido começa a ser lido sozinho e o arquivo pode ser removido', async () => {
        const user = userEvent.setup();
        let release: () => void = () => undefined;
        const held = new Promise<void>((resolve) => (release = resolve));
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = input instanceof Request ? input.url : input.toString();

            if (url.includes('/extract')) {
                await held;
            }

            return new Response(JSON.stringify({ data: [], meta: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        vi.stubGlobal('fetch', fetchMock);
        const { container } = renderWithProviders(
            <Assistant onClose={() => undefined} />,
        );

        await user.click(screen.getByRole('button', { name: /^Manual/ }));
        const input = container.ownerDocument.querySelector<HTMLInputElement>(
            'input[type="file"][accept="application/pdf"]',
        );
        expect(input).not.toBeNull();
        await user.upload(
            input as HTMLInputElement,
            new File(['%PDF-1.4'], 'ficha.pdf', { type: 'application/pdf' }),
        );

        // Sem botão de "Ler": anexou, já está lendo.
        expect(
            await screen.findByText(/A IA está lendo o manual/),
        ).toBeInTheDocument();
        expect(
            fetchMock.mock.calls.some(([url]) =>
                String(url instanceof Request ? url.url : url).includes(
                    '/extract',
                ),
            ),
        ).toBe(true);

        // Remover cancela a leitura e volta à área de soltar o arquivo.
        await user.click(
            screen.getByRole('button', {
                name: 'Cancelar leitura e remover arquivo: ficha.pdf',
            }),
        );
        expect(screen.queryByText('ficha.pdf')).not.toBeInTheDocument();
        expect(screen.getByText(/Arraste o PDF até aqui/)).toBeInTheDocument();
        release();
    });

    test('o duto da dutada pode ser redondo, retangular ou triangular', async () => {
        const user = userEvent.setup();
        typeMinimum();
        renderWithProviders(<Assistant onClose={() => undefined} />);

        await user.click(screen.getByRole('radio', { name: 'Dutada' }));
        expect(
            screen.getByRole('textbox', { name: /Diâmetro do duto/ }),
        ).toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: 'Triangular' }));
        expect(activeProjectStore().getState().data.box.port.shape).toBe(
            'triangle',
        );
        expect(
            screen.getByRole('textbox', { name: /Base do duto/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('textbox', { name: /Altura do duto/ }),
        ).toBeInTheDocument();
        expect(screen.getByText(/tábuas na diagonal/)).toBeInTheDocument();
    });

    test('medida externa pequena demais explica o mínimo e não é aplicada', async () => {
        const user = userEvent.setup();
        typeMinimum();
        renderWithProviders(<Assistant onClose={() => undefined} />);

        await user.click(screen.getByRole('radio', { name: 'Sei as medidas' }));
        const width = screen.getAllByRole('textbox', {
            name: /^Medida externa/,
        })[0];
        await user.clear(width);
        await user.type(width, '30{tab}');

        expect(screen.getByRole('alert')).toHaveTextContent(
            /A largura externa precisa passar de 36,0 mm/,
        );
    });

    test('o volume muda a caixa enquanto digita, antes de sair do campo', async () => {
        const user = userEvent.setup();
        typeMinimum();
        renderWithProviders(<Assistant onClose={() => undefined} />);

        const vb = screen.getByRole('textbox', { name: /^Vb/ });
        await user.clear(vb);
        await user.type(vb, '42');

        // Ainda com o foco no campo: o projeto (e a caixa desenhada) já está em 42 L.
        expect(document.activeElement).toBe(vb);
        await vi.waitFor(() =>
            expect(activeProjectStore().getState().data.box.vb_m3).toBeCloseTo(
                0.042,
                6,
            ),
        );
        // O texto não é reformatado no meio da digitação.
        expect(vb).toHaveValue('42');
    });

    test('Enter confirma o valor digitado, e sair depois não volta ao antigo', async () => {
        const user = userEvent.setup();
        typeMinimum();
        renderWithProviders(<Assistant onClose={() => undefined} />);

        const vb = screen.getByRole('textbox', { name: /^Vb/ });
        await user.clear(vb);
        await user.type(vb, '42{Enter}');

        expect(vb).toHaveValue('42,0');
        await user.tab();
        expect(activeProjectStore().getState().data.box.vb_m3).toBeCloseTo(
            0.042,
            6,
        );
        expect(vb).toHaveValue('42,0');

        await user.click(screen.getByRole('radio', { name: 'Sei as medidas' }));
        const height = screen.getAllByRole('textbox', {
            name: /^Medida externa/,
        })[1];
        await user.clear(height);
        await user.type(height, '555{Enter}');
        expect(height).toHaveValue('555,0');
        await user.tab();
        expect(height).toHaveValue('555,0');
    });

    test('a dutada mostra a profundidade do duto, com a trava na Fb ou no comprimento', async () => {
        const user = userEvent.setup();
        typeMinimum();
        renderWithProviders(<Assistant onClose={() => undefined} />);

        await user.click(screen.getByRole('radio', { name: 'Dutada' }));
        expect(
            screen.getByRole('textbox', { name: /Profundidade do duto/ }),
        ).toBeInTheDocument();
    });
});
