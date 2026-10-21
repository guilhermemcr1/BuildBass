import { screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vite-plus/test';
import { renderWithProviders } from '@/test/render';
import { Banner, Button, StatusIndicator, Tooltip } from './index';
import { SearchSelect } from './search-select';

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
