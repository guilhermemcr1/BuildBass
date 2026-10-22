import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { useExpanded } from '@/stores/expanded';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { ChartPanel } from './chart-panel';

// uPlot desenha em canvas, que o jsdom não tem; aqui só interessa o painel em volta do gráfico.
vi.mock('./chart-frame', () => ({
    default: ({
        limits,
        series = [],
        xRange,
        onZoom,
    }: {
        limits?: unknown[];
        series?: { label: string; color: number; dashed?: boolean }[];
        xRange?: [number, number];
        onZoom?: (range: [number, number]) => void;
    }) => (
        <div
            data-testid="chart-frame"
            data-limits={limits?.length ?? 0}
            data-series={JSON.stringify(series)}
            data-xrange={JSON.stringify(xRange)}
        >
            <button type="button" onClick={() => onZoom?.([20, 80])}>
                zoom
            </button>
        </div>
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
        color: number;
        dashed?: boolean;
    }[];
}

// O gráfico é carregado sob demanda: espera ele aparecer.
async function xRangeOf(): Promise<[number, number]> {
    return JSON.parse(
        (await screen.findByTestId('chart-frame')).dataset.xrange ?? '[]',
    ) as [number, number];
}

describe('ChartPanel — faixa de frequência', () => {
    beforeEach(() => {
        useWorkspace.setState(initialWorkspace());
    });

    test('começa de 10 Hz a 1 kHz e oferece até 20 kHz', async () => {
        renderWithProviders(<ChartPanel />);

        const group = screen.getByRole('radiogroup', {
            name: 'Faixa de frequência',
        });

        expect(
            within(group)
                .getAllByRole('radio')
                .map((radio) => radio.textContent),
        ).toEqual([
            '200Até 200 Hz',
            '1kAté 1 kHz',
            '5kAté 5 kHz',
            '10kAté 10 kHz',
            '20kAté 20 kHz',
        ]);
        expect(
            within(group).getByRole('radio', { name: 'Até 1 kHz' }),
        ).toHaveAttribute('aria-checked', 'true');
        expect(await xRangeOf()).toEqual([10, 1000]);

        await userEvent.click(
            within(group).getByRole('radio', { name: 'Até 20 kHz' }),
        );

        expect(await xRangeOf()).toEqual([10, 20000]);
    });

    test('o zoom pedido pelo gráfico vira a faixa, e o botão volta a faixa escolhida', async () => {
        renderWithProviders(<ChartPanel />);

        expect(
            screen.queryByRole('button', { name: 'Redefinir zoom' }),
        ).not.toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'zoom' }));

        expect(await xRangeOf()).toEqual([20, 80]);

        await userEvent.click(
            screen.getByRole('button', { name: 'Redefinir zoom' }),
        );

        expect(await xRangeOf()).toEqual([10, 1000]);
    });

    test('trocar a faixa desfaz o zoom', async () => {
        renderWithProviders(<ChartPanel />);

        await userEvent.click(screen.getByRole('button', { name: 'zoom' }));
        await userEvent.click(screen.getByRole('radio', { name: 'Até 5 kHz' }));

        expect(await xRangeOf()).toEqual([10, 5000]);
        expect(
            screen.queryByRole('button', { name: 'Redefinir zoom' }),
        ).not.toBeInTheDocument();
    });
});

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
        expect(series[1].color).toBe(series[0].color);
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

describe('ChartPanel — campo faltante em seção recolhida (specs/008, US7)', () => {
    beforeEach(() => {
        useWorkspace.setState(initialWorkspace());
        useExpanded.getState().collapseAll();
        const project = activeProjectStore().getState();
        project.setDriverValue('fs_hz', 28);
        project.setDriverValue('qts', 0.38);
        project.setDriverValue('vas_m3', 0.085);
        project.setBoxValue('vb_m3', 0.06);
        project.setBoxValue('fb_hz', 32);
    });

    test('nomeia o campo recolhido e "Mostrar campo" abre só a seção dele', async () => {
        renderWithProviders(<ChartPanel />);
        await userEvent.click(screen.getByRole('tab', { name: 'Impedância' }));

        // Faltam Re, Sd e Qms: dois deles (Re, Qms) estão recolhidos; Sd é essencial.
        expect(screen.getByText('Preencha Re, Sd e Qms.')).toBeInTheDocument();
        const show = screen.getByRole('button', { name: 'Mostrar campos' });

        await userEvent.click(show);

        expect(useExpanded.getState().open).toEqual({
            driverAdvanced: true,
            driverDims: false,
            planAdvanced: false,
        });
    });

    test('com a seção já aberta, o aviso não oferece a ação', async () => {
        useExpanded.getState().expand('driverAdvanced');
        renderWithProviders(<ChartPanel />);
        await userEvent.click(screen.getByRole('tab', { name: 'Impedância' }));

        expect(screen.getByText(/Preencha.*Re/)).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: /Mostrar campo/ }),
        ).not.toBeInTheDocument();
    });

    test('campo essencial faltando não gera o botão', () => {
        const project = activeProjectStore().getState();
        project.setDriverValue('qts', undefined);
        renderWithProviders(<ChartPanel />);

        expect(
            screen.queryByRole('button', { name: /Mostrar campo/ }),
        ).not.toBeInTheDocument();
    });
});
