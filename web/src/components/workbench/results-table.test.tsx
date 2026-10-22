import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import type { BoxInput } from '@/engine';
import { activeProjectStore } from '@/hooks/use-active-project';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { ResultsPanel } from './results-panel';

function driver() {
    const project = activeProjectStore().getState();
    project.setDriverValue('fs_hz', 28);
    project.setDriverValue('qts', 0.38);
    project.setDriverValue('qes', 0.42);
    project.setDriverValue('qms', 4.1);
    project.setDriverValue('vas_m3', 0.085);
    project.setDriverValue('re_ohm', 3.6);
    project.setDriverValue('sd_m2', 0.0491);
}

function box(next: Partial<BoxInput>) {
    activeProjectStore()
        .getState()
        .apply((data) => ({
            ...data,
            box: {
                ...data.box,
                vr_m3: 0.08,
                vf_m3: 0.04,
                fb_hz: 45,
                fb_rear_hz: 30,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
                port_rear: { shape: 'round', diameter_m: 0.1, count: 1 },
                ...next,
            },
        }));
}

// Dois projetos plotados: o primeiro (aba 1) e uma 2ª aba, que fica ativa.
function twoProjects(first: Partial<BoxInput>, second: Partial<BoxInput>) {
    driver();
    box(first);
    useWorkspace.getState().newProject();
    driver();
    box(second);
}

function rows() {
    return within(screen.getByRole('table')).getAllByRole('row');
}

describe('ResultsTable — bandpass de 6ª ordem', () => {
    beforeEach(() => {
        useWorkspace.setState(initialWorkspace());
    });

    test('as linhas do duto traseiro aparecem quando algum projeto plotado é de 6ª ordem', async () => {
        twoProjects({ type: 'bandpass6' }, { type: 'closed', vb_m3: 0.05 });

        renderWithProviders(<ResultsPanel />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Resultados' }),
        );

        const names = rows().map((row) => row.textContent ?? '');
        expect(names.some((text) => text.startsWith('Fbr'))).toBe(true);
        expect(
            names.some((text) =>
                text.startsWith('Comprimento do duto traseiro'),
            ),
        ).toBe(true);
        expect(
            names.some((text) =>
                text.startsWith('Velocidade máx. no duto traseiro'),
            ),
        ).toBe(true);
        expect(
            names.some((text) =>
                text.startsWith('Comprimento do duto frontal'),
            ),
        ).toBe(true);
    });

    test('sem projeto de 6ª ordem as linhas do duto traseiro não existem e o duto mantém o rótulo', async () => {
        twoProjects({ type: 'bandpass' }, { type: 'vented', vb_m3: 0.05 });

        renderWithProviders(<ResultsPanel />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Resultados' }),
        );

        const names = rows().map((row) => row.textContent ?? '');
        expect(names.some((text) => text.startsWith('Fbr'))).toBe(false);
        expect(names.some((text) => text.includes('duto traseiro'))).toBe(
            false,
        );
        expect(
            names.some((text) => text.startsWith('Comprimento do duto (')),
        ).toBe(true);
    });

    test('o projeto sem duto traseiro mostra traço nessas linhas', async () => {
        twoProjects({ type: 'bandpass6' }, { type: 'bandpass' });

        renderWithProviders(<ResultsPanel />);
        await userEvent.click(
            screen.getByRole('button', { name: 'Resultados' }),
        );

        const row = within(screen.getByRole('table')).getByRole('row', {
            name: /^Fbr/,
        });
        const cells = within(row).getAllByRole('cell');
        expect(cells).toHaveLength(2);
        // O ativo (4ª ordem) vem primeiro: traço; o da 6ª ordem tem valor.
        expect(cells[0]).toHaveTextContent('—');
        expect(cells[1]).not.toHaveTextContent('—');
    });
});
