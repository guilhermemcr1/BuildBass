import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { Focusable, Input, NumberField } from 'react-aria-components';
import { renderWithProviders } from '@/test/render';
import { HelpTip, useHoverless } from './help-tip';
import { Tooltip } from './tooltip';

function setHoverless(value: boolean) {
    vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
            matches: value && query === '(hover: none)',
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        })),
    );
}

// O primeiro movimento do ponteiro num documento só arma os ouvintes globais do React Aria; um
// movimento antes serve de aquecimento para o hover do teste valer.
function pointerUser() {
    const user = userEvent.setup();

    return { user, ready: user.pointer({ target: document.body }) };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('HelpTip', () => {
    test('abre ao focar o símbolo pelo teclado e fecha com Esc', async () => {
        renderWithProviders(
            <HelpTip content="Frequência de ressonância" label="Ajuda de Fs">
                <span>Fs</span>
            </HelpTip>,
        );

        await userEvent.tab();
        expect(await screen.findByRole('tooltip')).toHaveTextContent(
            'Frequência de ressonância',
        );

        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('abre ao pairar o mouse e o ponteiro pode ir até o tooltip', async () => {
        renderWithProviders(
            <HelpTip content="Frequência de ressonância" label="Ajuda de Fs">
                <span>Fs</span>
            </HelpTip>,
        );

        const { user, ready } = pointerUser();

        await ready;
        await user.pointer({ target: screen.getByText('Fs') });
        const tip = await screen.findByRole('tooltip');
        expect(tip).toBeInTheDocument();

        await user.pointer({ target: tip });
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('sem hover (toque) o símbolo vira um botão que abre um popover com o texto', async () => {
        setHoverless(true);
        renderWithProviders(
            <HelpTip content="Frequência de ressonância" label="Ajuda de Fs">
                <span>Fs</span>
            </HelpTip>,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Ajuda de Fs' }),
        );

        expect(await screen.findByRole('dialog')).toHaveTextContent(
            'Frequência de ressonância',
        );
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('com hover não existe o botão de ajuda', () => {
        setHoverless(false);
        renderWithProviders(
            <HelpTip content="x" label="Ajuda de Fs">
                <span>Fs</span>
            </HelpTip>,
        );

        expect(
            screen.queryByRole('button', { name: 'Ajuda de Fs' }),
        ).not.toBeInTheDocument();
    });

    test('useHoverless acompanha a media query (e é falso sem matchMedia)', () => {
        function Probe() {
            return <span>{useHoverless() ? 'toque' : 'mouse'}</span>;
        }

        renderWithProviders(<Probe />);
        expect(screen.getByText('mouse')).toBeInTheDocument();
    });
});

// Spike: o tooltip também precisa abrir pelo campo numérico do NumberField.
describe('Tooltip sobre o campo numérico', () => {
    test('abre ao focar e ao pairar o Input, fecha com Esc', async () => {
        renderWithProviders(
            <NumberField aria-label="Fs">
                <Tooltip content="Frequência de ressonância" delay={0}>
                    <Focusable>
                        <Input />
                    </Focusable>
                </Tooltip>
            </NumberField>,
        );
        const input = screen.getByRole('textbox');

        await userEvent.tab();
        expect(input).toHaveFocus();
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

        const { user, ready } = pointerUser();

        await ready;
        await user.pointer({ target: input });
        expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    });
});
