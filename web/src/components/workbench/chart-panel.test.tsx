import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { ChartPanel } from './chart-panel';

// uPlot desenha em canvas, que o jsdom não tem; aqui só interessa o painel em volta do gráfico.
vi.mock('./chart-frame', () => ({
    default: ({
        limits,
        series = [],
    }: {
        limits?: unknown[];
        series?: { label: string; slot: number; dashed?: boolean }[];
    }) => (
        <div
            data-testid="chart-frame"
            data-limits={limits?.length ?? 0}
            data-series={JSON.stringify(series)}
        />
    ),
}));

function sixthOrder(box: Record<string, unknown> = {}) {
    const project = activeProjectStore().getState();
    project.setDriverValue('fs_hz', 28);
    project.setDriverValue('qts', 0.38);
    project.setDriverValue('vas_m3', 0.085);
    project.setDriverValue('re_ohm', 3.6);
    project.setDriverValue('sd_m2', 0.0491);
    project.setDriverValue('qms', 4.1);
    project.apply((data) => ({
        ...data,
        box: {
            ...data.box,
            type: 'bandpass6',
            vr_m3: 0.08,
            vf_m3: 0.04,
            fb_hz: 45,
            fb_rear_hz: 30,
            port: { shape: 'round', diameter_m: 0.1, count: 1 },
            port_rear: { shape: 'round', diameter_m: 0.1, count: 1 },
            ...box,
        },
    }));
}

function seriesOf(frame: HTMLElement) {
    return JSON.parse(frame.dataset.series ?? '[]') as {
        label: string;
        slot: number;
        dashed?: boolean;
    }[];
}

describe('ChartPanel', () => {
    beforeEach(() => {
        useWorkspace.setState(initialWorkspace());
    });

    test('sem parâmetros lista o que falta, inclusive da caixa', () => {
        renderWithProviders(<ChartPanel />);

        expect(
            screen.getByText('Faltam parâmetros para desenhar o gráfico'),
        ).toBeInTheDocument();
        expect(
            screen.getByText('Preencha Fs, Qts, Vas, Vb e Fb.'),
        ).toBeInTheDocument();
    });

    test('com driver e caixa preenchidos desenha a resposta', async () => {
        const project = activeProjectStore().getState();
        project.setDriverValue('fs_hz', 28);
        project.setDriverValue('qts', 0.38);
        project.setDriverValue('vas_m3', 0.085);
        project.setBoxValue('vb_m3', 0.06);
        project.setBoxValue('fb_hz', 32);

        renderWithProviders(<ChartPanel />);

        expect(await screen.findByTestId('chart-frame')).toBeInTheDocument();
        expect(
            screen.queryByText('Faltam parâmetros para desenhar o gráfico'),
        ).not.toBeInTheDocument();
    });

    test('caixa selada desativa a aba de velocidade no duto com o motivo', () => {
        activeProjectStore().getState().setBoxType('closed');

        renderWithProviders(<ChartPanel />);

        expect(
            screen.getByRole('tab', { name: 'Velocidade no duto' }),
        ).toHaveAttribute('aria-disabled', 'true');
        expect(
            screen.getByText('Velocidade no duto: Caixa selada não tem duto.'),
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

    test('bandpass ativa a aba de velocidade no duto', () => {
        activeProjectStore().getState().setBoxType('bandpass');

        renderWithProviders(<ChartPanel />);

        expect(
            screen.getByRole('tab', { name: 'Velocidade no duto' }),
        ).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('bandpass: a aba de velocidade traz os limites de 17 e 25 m/s', async () => {
        const project = activeProjectStore().getState();
        project.setDriverValue('fs_hz', 28);
        project.setDriverValue('qts', 0.38);
        project.setDriverValue('vas_m3', 0.085);
        project.setDriverValue('re_ohm', 3.6);
        project.setDriverValue('sd_m2', 0.0491);
        project.setDriverValue('qms', 4.1);
        project.apply((data) => ({
            ...data,
            box: {
                ...data.box,
                type: 'bandpass',
                vr_m3: 0.04,
                vf_m3: 0.06,
                fb_hz: 45,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            },
        }));

        renderWithProviders(<ChartPanel selected="portVelocity" />);

        expect(await screen.findByTestId('chart-frame')).toHaveAttribute(
            'data-limits',
            '2',
        );
    });

    test('bandpass 6ª ordem ativa a aba de velocidade no duto', () => {
        activeProjectStore().getState().setBoxType('bandpass6');

        renderWithProviders(<ChartPanel />);

        expect(
            screen.getByRole('tab', { name: 'Velocidade no duto' }),
        ).not.toHaveAttribute('aria-disabled', 'true');
    });

    test('bandpass 6ª ordem: duas séries de velocidade, a traseira tracejada na mesma cor', async () => {
        sixthOrder();

        renderWithProviders(<ChartPanel selected="portVelocity" />);

        const series = seriesOf(await screen.findByTestId('chart-frame'));
        expect(series).toHaveLength(2);
        expect(series[0].label).toMatch(/— frontal$/);
        expect(series[0].dashed).toBeUndefined();
        expect(series[1].label).toMatch(/— traseiro$/);
        expect(series[1].dashed).toBe(true);
        expect(series[1].slot).toBe(series[0].slot);
    });

    test('em inglês a legenda diz front / rear', async () => {
        sixthOrder();

        renderWithProviders(<ChartPanel selected="portVelocity" />, 'en');

        const series = seriesOf(await screen.findByTestId('chart-frame'));
        expect(series.map(({ label }) => label.split(' — ')[1])).toEqual([
            'front',
            'rear',
        ]);
    });

    test('bandpass 6ª ordem: as outras abas seguem com uma série', async () => {
        sixthOrder();

        renderWithProviders(<ChartPanel selected="response" />);

        expect(seriesOf(await screen.findByTestId('chart-frame'))).toHaveLength(
            1,
        );
    });

    test('sem as medidas do duto traseiro a série traseira some e o texto lista o que falta', async () => {
        sixthOrder({ port_rear: { shape: 'round', count: 1 } });

        renderWithProviders(<ChartPanel selected="portVelocity" />);

        const series = seriesOf(await screen.findByTestId('chart-frame'));
        expect(series).toHaveLength(1);
        expect(series[0].dashed).toBeUndefined();
        expect(series[0].label).not.toMatch(/frontal|traseiro/);
    });

    test('dutada e 4ª ordem continuam com uma série de velocidade', async () => {
        sixthOrder({ type: 'bandpass' });

        renderWithProviders(<ChartPanel selected="portVelocity" />);

        expect(seriesOf(await screen.findByTestId('chart-frame'))).toHaveLength(
            1,
        );
    });
});
