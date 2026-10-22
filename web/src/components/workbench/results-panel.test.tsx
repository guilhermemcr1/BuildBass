import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import type { BoxInput } from '@/engine';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { ResultsPanel } from './results-panel';

function tile(label: string): HTMLElement {
    const element = screen.getByText(label).parentElement;

    if (element === null) {
        throw new Error(label);
    }

    return element;
}

// Bandpass completa, com o driver de referência da quickstart; `box` sobrescreve a caixa.
function bandpassProject(box: Partial<BoxInput> = {}) {
    const project = activeProjectStore().getState();
    project.setDriverValue('fs_hz', 28);
    project.setDriverValue('qts', 0.38);
    project.setDriverValue('qes', 0.42);
    project.setDriverValue('qms', 4.1);
    project.setDriverValue('vas_m3', 0.085);
    project.setDriverValue('re_ohm', 3.6);
    project.setDriverValue('sd_m2', 0.0491);
    project.setDriverValue('xmax_m', 0.014);
    project.apply((data) => ({
        ...data,
        box: {
            ...data.box,
            type: 'bandpass',
            vr_m3: 0.04,
            vf_m3: 0.06,
            fb_hz: 45,
            port: { shape: 'round', diameter_m: 0.1, count: 1 },
            ...box,
        },
    }));
}

// Bandpass de 6ª ordem completa (mesmo driver de referência).
function sixthOrderProject(box: Partial<BoxInput> = {}) {
    bandpassProject({
        type: 'bandpass6',
        vr_m3: 0.08,
        vf_m3: 0.04,
        fb_hz: 45,
        fb_rear_hz: 30,
        port_rear: { shape: 'round', diameter_m: 0.1, count: 1 },
        ...box,
    });
}

describe('ResultsPanel', () => {
    beforeEach(() => {
        useWorkspace.setState(initialWorkspace());
    });

    test('sem dados mostra traços', () => {
        renderWithProviders(<ResultsPanel />);

        expect(tile('F3')).toHaveTextContent('—');
    });

    test('caixa selada mostra Qtc, fc e F3 calculados', () => {
        const project = activeProjectStore().getState();
        project.setBoxType('closed');
        project.setDriverValue('fs_hz', 30);
        project.setDriverValue('qts', 0.5);
        project.setDriverValue('vas_m3', 0.05);
        project.setBoxValue('vb_m3', 0.05);

        renderWithProviders(<ResultsPanel />);

        expect(tile('Qtc')).toHaveTextContent('0,71');
        expect(tile('fc')).toHaveTextContent('42,4');
        expect(tile('F3')).not.toHaveTextContent('—');
    });

    test('bandpass mostra os cortes da banda e não mostra F3, Qtc nem fc', () => {
        bandpassProject();

        renderWithProviders(<ResultsPanel />);

        for (const label of [
            'Corte inferior',
            'Corte superior',
            'Frequência central',
            'Largura da banda',
            'Nível de pico',
            'Fb',
            'Comprimento do duto',
            'Velocidade máx. no duto',
            'Potência no Xmax',
            'Sensibilidade (1 W/1 m)',
            'Eficiência',
        ]) {
            expect(screen.getByText(label), label).toBeVisible();
        }

        expect(tile('Corte inferior')).not.toHaveTextContent('—');
        expect(tile('Corte superior')).not.toHaveTextContent('—');
        expect(tile('Largura da banda')).toHaveTextContent('oct');
        expect(screen.queryByText('F3')).toBeNull();
        expect(screen.queryByText('Qtc')).toBeNull();
        expect(screen.queryByText('fc')).toBeNull();
    });

    test('corte fora da grade mostra < 10 e > 1000', () => {
        bandpassProject({ vr_m3: 5, vf_m3: 5, fb_hz: 8 });
        const { unmount } = renderWithProviders(<ResultsPanel />);

        expect(tile('Corte inferior')).toHaveTextContent('< 10');
        unmount();

        bandpassProject({
            vr_m3: 0.001,
            vf_m3: 0.0002,
            fb_hz: 800,
            port: { shape: 'round', count: 1 },
        });
        renderWithProviders(<ResultsPanel />);

        expect(tile('Corte superior')).toHaveTextContent('> 1000');
    });

    test('com vários projetos o painel começa recolhido, com o resumo, e abre à mão', async () => {
        bandpassProject();
        useWorkspace.getState().newProject();

        renderWithProviders(<ResultsPanel />);

        expect(screen.queryByRole('table')).not.toBeInTheDocument();
        expect(screen.getByText('2 projetos no gráfico')).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole('button', { name: 'Resultados' }),
        );

        expect(screen.getByRole('table')).toBeInTheDocument();
    });

    test('com um projeto só o painel começa aberto', () => {
        bandpassProject();

        renderWithProviders(<ResultsPanel />);

        expect(
            screen.getByRole('button', { name: 'Resultados' }),
        ).toHaveAttribute('aria-expanded', 'true');
    });

    test('comparação: a tabela lista a união das linhas e traço onde não se aplica', async () => {
        bandpassProject();
        useWorkspace.getState().newProject(); // 2ª aba, ligada no gráfico
        const second = activeProjectStore().getState();
        second.setBoxType('closed');
        second.setDriverValue('fs_hz', 28);
        second.setDriverValue('qts', 0.38);
        second.setDriverValue('vas_m3', 0.085);
        second.setBoxValue('vb_m3', 0.05);

        renderWithProviders(<ResultsPanel />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Resultados' }),
        );

        const table = screen.getByRole('table');
        const row = (label: string) =>
            within(table).getByRole('row', { name: new RegExp(label) });

        expect(row('F3')).toBeVisible();
        expect(row('Corte inferior')).toBeVisible();
        expect(row('Largura da banda')).toBeVisible();
        // O projeto ativo é a selada: sem corte inferior.
        expect(within(row('Corte inferior')).getAllByRole('cell')).toHaveLength(
            2,
        );
        expect(row('Corte inferior')).toHaveTextContent('—');
    });

    test('bandpass 6ª ordem: tiles da 4ª ordem mais Fbr e o duto traseiro, com o frontal identificado', () => {
        sixthOrderProject();

        renderWithProviders(<ResultsPanel />);

        for (const label of [
            'Corte inferior',
            'Corte superior',
            'Frequência central',
            'Largura da banda',
            'Nível de pico',
            'Fb',
            'Fbr',
            'Comprimento do duto frontal',
            'Velocidade máx. no duto frontal',
            'Comprimento do duto traseiro',
            'Velocidade máx. no duto traseiro',
            'Potência no Xmax',
        ]) {
            expect(screen.getByText(label), label).toBeVisible();
        }

        expect(tile('Fbr')).toHaveTextContent('30');
        expect(tile('Comprimento do duto traseiro')).not.toHaveTextContent('—');
        expect(tile('Velocidade máx. no duto traseiro')).not.toHaveTextContent(
            '—',
        );
        expect(screen.queryByText('Comprimento do duto')).toBeNull();
        expect(screen.queryByText('F3')).toBeNull();
    });

    test('bandpass 6ª ordem: um duto curto demais avisa só no tile da sua câmara', () => {
        sixthOrderProject({
            vr_m3: 0.2,
            fb_rear_hz: 100,
            port_rear: { shape: 'round', diameter_m: 0.05, count: 1 },
        });

        renderWithProviders(<ResultsPanel />);

        expect(tile('Comprimento do duto traseiro')).toHaveTextContent(
            'Curto demais',
        );
        expect(tile('Comprimento do duto frontal')).not.toHaveTextContent(
            'Curto demais',
        );
    });

    test('a 4ª ordem não mostra Fbr nem o duto traseiro', () => {
        bandpassProject();

        renderWithProviders(<ResultsPanel />);

        expect(screen.queryByText('Fbr')).toBeNull();
        expect(screen.queryByText('Comprimento do duto traseiro')).toBeNull();
        expect(screen.getByText('Comprimento do duto')).toBeVisible();
    });

    test('bandpass 6ª ordem: velocidade alta só no duto traseiro avisa nesse duto', () => {
        sixthOrderProject({
            port_rear: { shape: 'round', diameter_m: 0.03, count: 1 },
        });

        renderWithProviders(<ResultsPanel />);

        // 22 m/s: entre 17 e 25 → atenção; o frontal, a ~1,8 m/s, fica abaixo de 17.
        expect(tile('Velocidade máx. no duto traseiro')).toHaveTextContent(
            'Ruído audível',
        );
        expect(tile('Velocidade máx. no duto frontal')).toHaveTextContent(
            'Abaixo de',
        );
    });

    test('bandpass 6ª ordem: acima de 25 m/s no duto traseiro é erro, e o frontal segue o seu valor', () => {
        sixthOrderProject({
            port_rear: { shape: 'round', diameter_m: 0.05, count: 1 },
        });
        activeProjectStore().getState().setSignal({ power_w: 20 });

        renderWithProviders(<ResultsPanel />);

        expect(tile('Velocidade máx. no duto traseiro')).toHaveTextContent(
            'Acima de',
        );
        expect(tile('Velocidade máx. no duto frontal')).toHaveTextContent(
            'Abaixo de',
        );
    });

    test('bandpass 6ª ordem: os dois dutos altos mostram os dois estados', () => {
        sixthOrderProject({
            port_rear: { shape: 'round', diameter_m: 0.03, count: 1 },
        });
        activeProjectStore().getState().setSignal({ power_w: 100 });

        renderWithProviders(<ResultsPanel />);

        expect(tile('Velocidade máx. no duto traseiro')).toHaveTextContent(
            'Acima de',
        );
        expect(tile('Velocidade máx. no duto frontal')).toHaveTextContent(
            'Ruído audível',
        );
    });
});
