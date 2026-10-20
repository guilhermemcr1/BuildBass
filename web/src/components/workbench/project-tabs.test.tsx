import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { createProjectData } from '@/lib/project/types';
import { renderWithProviders } from '@/test/render';
import {
    initialWorkspace,
    projectStore,
    useWorkspace,
} from '@/stores/workspace';
import { CloseProjectDialog } from './close-project-dialog';
import { ProjectTabs } from './project-tabs';
import { TabLimitDialog } from './tab-limit-dialog';

function workspace() {
    return useWorkspace.getState();
}

describe('ProjectTabs', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('lista os projetos, marca o ativo e troca ao clicar', async () => {
        workspace().openProject(createProjectData('Sub'));
        renderWithProviders(<ProjectTabs onClose={() => undefined} />);
        const nav = screen.getByRole('navigation', {
            name: 'Projetos abertos',
        });

        const sub = within(nav).getByRole('button', { name: 'Sub' });
        expect(sub).toHaveAttribute('aria-current', 'true');

        await userEvent.click(
            within(nav).getByRole('button', { name: 'Projeto sem nome' }),
        );
        expect(workspace().activeId).toBe(workspace().projects[0].id);
    });

    test('renomeia com duplo clique (Enter) e cancela com Esc (F2)', async () => {
        renderWithProviders(<ProjectTabs onClose={() => undefined} />);
        const id = workspace().projects[0].id;

        await userEvent.dblClick(
            screen.getByRole('button', { name: 'Projeto sem nome' }),
        );
        const input = screen.getByRole('textbox', {
            name: 'Renomear Projeto sem nome',
        });
        await userEvent.type(input, 'Caixa A{Enter}');
        expect(projectStore(id).getState().data.name).toBe('Caixa A');

        screen.getByRole('button', { name: /^Caixa A/ }).focus();
        await userEvent.keyboard('{F2}');
        await userEvent.type(
            screen.getByRole('textbox', { name: 'Renomear Caixa A' }),
            'Outra{Escape}',
        );
        expect(projectStore(id).getState().data.name).toBe('Caixa A');
    });

    test('alterna "mostrar no gráfico" e pede para fechar', async () => {
        const onClose = vi.fn();
        renderWithProviders(<ProjectTabs onClose={onClose} />);
        const id = workspace().projects[0].id;

        const plot = screen.getByRole('button', {
            name: 'Mostrar Projeto sem nome no gráfico',
        });
        expect(plot).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(plot);
        expect(workspace().projects[0].plotted).toBe(false);
        expect(plot).toHaveAttribute('aria-pressed', 'false');

        await userEvent.click(
            screen.getByRole('button', { name: 'Fechar Projeto sem nome' }),
        );
        expect(onClose).toHaveBeenCalledWith(id);
    });

    test('projeto alterado mostra o aviso de não exportado', () => {
        renderWithProviders(<ProjectTabs onClose={() => undefined} />);
        act(() =>
            projectStore(workspace().projects[0].id)
                .getState()
                .setBoxValue('vb_m3', 0.05),
        );

        expect(
            screen.getByRole('button', {
                // O jsdom junta os textos sem o espaço; o navegador mantém (e2e).
                name: /^Projeto sem nome ?\(alterações não exportadas\)$/,
            }),
        ).toBeInTheDocument();
    });
});

describe('diálogos de projeto', () => {
    beforeEach(() => {
        useWorkspace.setState(initialWorkspace());
    });

    test('limite de 3 lista os projetos com botão de fechar', async () => {
        workspace().newProject();
        workspace().openProject(createProjectData('Sub'));
        const onCloseProject = vi.fn();
        renderWithProviders(
            <TabLimitDialog
                open
                onCloseProject={onCloseProject}
                onCancel={() => undefined}
            />,
        );
        const dialog = screen.getByRole('dialog', {
            name: 'Limite de projetos abertos',
        });

        expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Fechar Sub' }),
        );
        expect(onCloseProject).toHaveBeenCalledWith(workspace().projects[2].id);
    });

    test('fechar com alterações oferece exportar, descartar ou cancelar', async () => {
        const onExportAndClose = vi.fn();
        const onDiscard = vi.fn();
        renderWithProviders(
            <CloseProjectDialog
                name="Sub"
                onExportAndClose={onExportAndClose}
                onDiscard={onDiscard}
                onCancel={() => undefined}
            />,
        );
        const dialog = screen.getByRole('dialog', { name: 'Fechar projeto?' });

        expect(dialog).toHaveTextContent('“Sub” tem alterações');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Fechar sem exportar' }),
        );
        expect(onDiscard).toHaveBeenCalled();
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Exportar e fechar' }),
        );
        expect(onExportAndClose).toHaveBeenCalled();
    });
});
