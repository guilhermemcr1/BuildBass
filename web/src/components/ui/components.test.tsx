import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vite-plus/test';
import { renderWithProviders } from '@/test/render';
import { Banner, Button, StatusIndicator, Tooltip } from './index';

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
