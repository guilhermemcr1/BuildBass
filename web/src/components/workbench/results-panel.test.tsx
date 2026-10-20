import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
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
});
