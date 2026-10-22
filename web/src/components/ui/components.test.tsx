import { act, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vite-plus/test';
import { renderWithProviders } from '@/test/render';
import { Banner, Button, StatusIndicator, Switch, Tooltip } from './index';
import { SearchSelect } from './search-select';
import { SelectField } from './select-field';

describe('Button', () => {
    test('aciona com Enter e com Espaço', async () => {
        const onPress = vi.fn();
        renderWithProviders(<Button onPress={onPress}>Exportar</Button>);

        await userEvent.tab();
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');

        expect(onPress).toHaveBeenCalledTimes(2);
    });

    test('desativado não aciona', async () => {
        const onPress = vi.fn();
        renderWithProviders(
            <Button onPress={onPress} disabled>
                Catálogo
            </Button>,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Catálogo' }));

        expect(onPress).not.toHaveBeenCalled();
        expect(screen.getByRole('button')).toBeDisabled();
    });
});

describe('Tooltip', () => {
    test('abre quando o gatilho recebe foco pelo teclado', async () => {
        renderWithProviders(
            <Tooltip content="Frequência de ressonância" delay={0}>
                <Button>Fs</Button>
            </Tooltip>,
        );

        await userEvent.tab();

        expect(await screen.findByRole('tooltip')).toHaveTextContent(
            'Frequência de ressonância',
        );
    });
});

describe('Switch', () => {
    function Probe() {
        const [on, setOn] = useState(false);

        return (
            <Switch selected={on} onChange={setOn}>
                Modo Pro
            </Switch>
        );
    }

    test('liga e desliga com clique e com Espaço, e expõe o estado', async () => {
        renderWithProviders(<Probe />);
        const toggle = screen.getByRole('switch', { name: 'Modo Pro' });

        expect(toggle).not.toBeChecked();

        await userEvent.click(toggle);
        expect(toggle).toBeChecked();

        await userEvent.keyboard(' ');
        expect(toggle).not.toBeChecked();
    });
});

describe('Tooltip com delay', () => {
    test('espera o delay ao pairar, também ao passar de um gatilho para outro', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        try {
            const user = userEvent.setup({
                advanceTimers: (ms) => vi.advanceTimersByTime(ms),
            });

            renderWithProviders(
                <>
                    <Tooltip content="Ajuda A" delay={1000}>
                        <Button>A</Button>
                    </Tooltip>
                    <Tooltip content="Ajuda B" delay={1000}>
                        <Button>B</Button>
                    </Tooltip>
                </>,
            );

            // O primeiro movimento só arma os ouvintes globais do React Aria.
            await user.pointer({ target: document.body });
            await user.pointer({ target: screen.getByRole('button', { name: 'A' }) });
            await act(() => vi.advanceTimersByTimeAsync(900));
            expect(screen.queryByRole('tooltip')).toBeNull();

            await act(() => vi.advanceTimersByTimeAsync(200));
            expect(screen.getByRole('tooltip')).toHaveTextContent('Ajuda A');

            // O segundo gatilho logo em seguida: o "aquecimento" do React Aria não pode pular a espera.
            await user.pointer({ target: screen.getByRole('button', { name: 'B' }) });
            await act(() => vi.advanceTimersByTimeAsync(900));
            expect(screen.queryByText('Ajuda B')).toBeNull();

            await act(() => vi.advanceTimersByTimeAsync(200));
            expect(screen.getByRole('tooltip')).toHaveTextContent('Ajuda B');
        } finally {
            vi.useRealTimers();
        }
    });

    test('sair antes do delay cancela a abertura', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });

        try {
            const user = userEvent.setup({
                advanceTimers: (ms) => vi.advanceTimersByTime(ms),
            });

            renderWithProviders(
                <Tooltip content="Ajuda A" delay={1000}>
                    <Button>A</Button>
                </Tooltip>,
            );

            await user.pointer({ target: document.body });
            await user.pointer({ target: screen.getByRole('button', { name: 'A' }) });
            await act(() => vi.advanceTimersByTimeAsync(500));
            await user.pointer({ target: document.body });
            await act(() => vi.advanceTimersByTimeAsync(2000));

            expect(screen.queryByRole('tooltip')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('StatusIndicator', () => {
    test.each([
        ['ok', 'Consistente'],
        ['warn', 'Atenção'],
        ['error', 'Erro'],
        ['unchecked', 'Sem verificação'],
    ] as const)('estado %s tem texto acessível', (status, text) => {
        renderWithProviders(<StatusIndicator status={status} />);

        expect(screen.getByText(text)).toBeInTheDocument();
    });

    test('estado none não mostra nada', () => {
        const { container } = renderWithProviders(
            <StatusIndicator status="none" />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});

describe('Banner', () => {
    test('é anunciado como status', () => {
        renderWithProviders(<Banner tone="warn">Sem conexão.</Banner>);

        expect(screen.getByRole('status')).toHaveTextContent('Sem conexão.');
    });
});

describe('SearchSelect', () => {
    const items = [
        { id: '1', label: 'Alfa' },
        { id: '2', label: 'Beta', description: 'segunda linha' },
    ];

    test('modo estático filtra a lista pelo que se digita', async () => {
        renderWithProviders(
            <SearchSelect label="Busca" items={items} onSelect={vi.fn()} />,
        );

        await userEvent.type(screen.getByRole('combobox'), 'bet');

        expect(screen.getByRole('option', { name: /Beta/ })).toBeVisible();
        expect(screen.queryByRole('option', { name: /Alfa/ })).toBeNull();
    });

    test('modo controlado não filtra: mostra os itens recebidos e a descrição', async () => {
        function Controlled() {
            const [value, setValue] = useState('');

            return (
                <SearchSelect
                    label="Busca"
                    items={items}
                    inputValue={value}
                    onInputChange={setValue}
                    onSelect={vi.fn()}
                    status="2 resultados"
                />
            );
        }
        renderWithProviders(<Controlled />);

        await userEvent.type(screen.getByRole('combobox'), 'zzz');

        expect(screen.getByRole('option', { name: /Alfa/ })).toBeVisible();
        expect(screen.getByRole('option', { name: /Beta/ })).toHaveTextContent(
            'segunda linha',
        );
        expect(screen.getByText('2 resultados')).toBeInTheDocument();
    });
});

describe('SelectField', () => {
    const options = [
        { id: 'golden', label: 'Áurea' },
        { id: 'louden', label: 'Louden' },
        { id: 'cube', label: 'Cúbica' },
    ];

    function Harness({ disabled = false }: { disabled?: boolean }) {
        const [selected, setSelected] = useState('golden');

        return (
            <SelectField
                label="Proporção"
                options={options}
                selected={selected}
                onChange={setSelected}
                disabled={disabled}
            />
        );
    }

    test('tem rótulo acessível e mostra a opção escolhida', () => {
        renderWithProviders(<Harness />);

        const button = screen.getByRole('button', { name: /Proporção/ });

        expect(button).toHaveTextContent('Áurea');
    });

    test('abre com Enter, as setas escolhem e o valor aparece no botão', async () => {
        renderWithProviders(<Harness />);

        await userEvent.tab();
        await userEvent.keyboard('{Enter}');

        expect(screen.getByRole('listbox')).toBeVisible();

        await userEvent.keyboard('{ArrowDown}{Enter}');

        expect(screen.queryByRole('listbox')).toBeNull();
        expect(screen.getByRole('button', { name: /Proporção/ })).toHaveTextContent(
            'Louden',
        );
    });

    test('abre com o mouse e escolhe uma opção', async () => {
        renderWithProviders(<Harness />);

        await userEvent.click(screen.getByRole('button', { name: /Proporção/ }));
        await userEvent.click(screen.getByRole('option', { name: 'Cúbica' }));

        expect(screen.getByRole('button', { name: /Proporção/ })).toHaveTextContent(
            'Cúbica',
        );
    });

    test('desativado não abre', async () => {
        renderWithProviders(<Harness disabled />);

        await userEvent.click(screen.getByRole('button', { name: /Proporção/ }));

        expect(screen.queryByRole('listbox')).toBeNull();
    });
});
