import { screen, within } from '@testing-library/react';
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

    test('comparação: a tabela lista a união das linhas e traço onde não se aplica', () => {
        bandpassProject();
        useWorkspace.getState().newProject(); // 2ª aba, ligada no gráfico
        const second = activeProjectStore().getState();
        second.setBoxType('closed');
        second.setDriverValue('fs_hz', 28);
        second.setDriverValue('qts', 0.38);
        second.setDriverValue('vas_m3', 0.085);
        second.setBoxValue('vb_m3', 0.05);

        renderWithProviders(<ResultsPanel />);

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
});
