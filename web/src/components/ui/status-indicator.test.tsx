import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vite-plus/test';
import { renderWithProviders } from '@/test/render';
import { StatusIndicator } from './status-indicator';

describe('StatusIndicator compact', () => {
    test.each([
        ['ok', 'OK', 'Consistente'],
        ['warn', 'Atenção', 'Atenção'],
        ['error', 'Erro', 'Erro'],
        ['unchecked', 'Sem verif.', 'Sem verificação'],
    ] as const)(
        'estado %s mostra o texto curto e anuncia o completo',
        (status, short, full) => {
            const { container } = renderWithProviders(
                <StatusIndicator status={status} size="compact" />,
            );

            expect(screen.getByText(short, { selector: '[aria-hidden]' }))
                .toBeVisible();
            expect(screen.getByText(full, { selector: '.sr-only' }))
                .toBeInTheDocument();
            expect(container.querySelector('svg')).toBeInTheDocument();
            expect(container.firstElementChild).toHaveClass('text-[11px]');
        },
    );

    test('o tamanho padrão continua com o rótulo completo e sem texto curto', () => {
        renderWithProviders(<StatusIndicator status="unchecked" />);

        expect(screen.getByText('Sem verificação')).toBeVisible();
        expect(screen.queryByText('Sem verif.')).not.toBeInTheDocument();
    });

    test('em inglês o texto curto também existe', () => {
        renderWithProviders(
            <StatusIndicator status="unchecked" size="compact" />,
            'en',
        );

        expect(screen.getByText('Unchecked')).toBeInTheDocument();
        expect(screen.getByText('Not checked', { selector: '.sr-only' }))
            .toBeInTheDocument();
    });

    test('none não renderiza nada', () => {
        const { container } = renderWithProviders(
            <StatusIndicator status="none" size="compact" />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
