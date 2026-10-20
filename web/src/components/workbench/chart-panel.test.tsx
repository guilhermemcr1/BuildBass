import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { useDraft } from '@/stores/draft';
import { renderWithProviders } from '@/test/render';
import { ChartPanel } from './chart-panel';

// uPlot desenha em canvas, que o jsdom não tem; aqui só interessa o painel em volta do gráfico.
vi.mock('./chart-frame', () => ({
    default: () => <div data-testid="chart-frame" />,
}));

describe('ChartPanel', () => {
    beforeEach(() => {
        useDraft.getState().reset();
    });

    test('sem parâmetros lista Fs, Qts e Vas como faltantes', () => {
        renderWithProviders(<ChartPanel />);

        expect(
            screen.getByText('Faltam parâmetros para desenhar o gráfico'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Preencha Fs, Qts e Vas na região do driver.'),
        ).toBeInTheDocument();
    });

    test('com Fs, Qts e Vas preenchidos avisa que as curvas chegam com o motor', () => {
        useDraft.getState().setValue('fs_hz', 28);
        useDraft.getState().setValue('qts', 0.38);
        useDraft.getState().setValue('vas_m3', 0.085);

        renderWithProviders(<ChartPanel />);

        expect(
            screen.getByText(
                'Parâmetros prontos. As curvas chegam com o motor de cálculo.',
            ),
        ).toBeInTheDocument();
    });

    test('as abas trocam com as setas do teclado', async () => {
        renderWithProviders(<ChartPanel />);

        await userEvent.click(screen.getByRole('tab', { name: 'Resposta' }));
        await userEvent.keyboard('{ArrowRight}');

        expect(screen.getByRole('tab', { name: 'Excursão' })).toHaveAttribute(
            'aria-selected',
            'true',
        );
    });
});
