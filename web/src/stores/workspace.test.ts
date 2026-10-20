import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { createProjectData } from '@/lib/project/types';
import { usePreferences } from './preferences';
import {
    WORKSPACE_KEY,
    initialWorkspace,
    projectStore,
    reloadFromStorage,
    storageProbe,
    useWorkspace,
} from './workspace';

function workspace() {
    return useWorkspace.getState();
}

describe('workspace', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('começa com um projeto vazio ativo e plotado', () => {
        expect(workspace().projects).toHaveLength(1);
        expect(workspace().activeId).toBe(workspace().projects[0].id);
        expect(workspace().projects[0]).toMatchObject({
            slot: 1,
            plotted: true,
            unsaved: false,
        });
    });

    test('abre até 3 projetos, cada um com o menor slot livre', () => {
        expect(workspace().newProject()).toBe('ok');
        expect(workspace().openProject(createProjectData('Sub'))).toBe('ok');
        expect(workspace().newProject()).toBe('limit');
        expect(workspace().openProject(createProjectData('Outro'))).toBe(
            'limit',
        );
        expect(workspace().projects.map((p) => p.slot)).toEqual([1, 2, 3]);
        expect(workspace().activeId).toBe(workspace().projects[2].id);
    });

    test('abrir um projeto com nome repetido acrescenta (2)', () => {
        workspace().openProject(createProjectData('Sub'));
        workspace().openProject(createProjectData('Sub'));

        expect(workspace().projects.map((p) => p.data.name)).toEqual([
            '',
            'Sub',
            'Sub (2)',
        ]);
    });

    test('fechar move o ativo para a aba à esquerda e libera o slot', () => {
        workspace().newProject();
        workspace().newProject();
        const [first, second, third] = workspace().projects;

        workspace().setActive(second.id);
        workspace().closeProject(second.id);
        expect(workspace().activeId).toBe(first.id);

        workspace().newProject();
        expect(workspace().projects.map((p) => p.slot)).toEqual([1, 3, 2]);
        expect(workspace().projects[1].id).toBe(third.id);
    });

    test('fechar o último cria um projeto vazio novo', () => {
        const only = workspace().projects[0].id;
        workspace().closeProject(only);

        expect(workspace().projects).toHaveLength(1);
        expect(workspace().projects[0].id).not.toBe(only);
    });

    test('edição no store do projeto marca como não exportado; exportar limpa', () => {
        const id = workspace().activeId;
        projectStore(id).getState().setDriverValue('fs_hz', 28);

        expect(workspace().projects[0].data.driver.fs_hz).toBe(28);
        expect(workspace().projects[0].unsaved).toBe(true);
        workspace().markExported(id);
        expect(workspace().projects[0].unsaved).toBe(false);
    });

    test('alternar plotagem', () => {
        const id = workspace().activeId;
        workspace().togglePlotted(id);

        expect(workspace().projects[0].plotted).toBe(false);
    });

    test('persiste projetos, ativo e plotagem e restaura', async () => {
        workspace().openProject(createProjectData('Sub'));
        const saved = workspace();
        workspace().togglePlotted(saved.projects[0].id);

        const stored = JSON.parse(localStorage.getItem(WORKSPACE_KEY) ?? '{}');
        expect(stored.version).toBe(1);
        expect(stored.state.projects).toHaveLength(2);

        // Simula reabrir o app: estado novo em memória, armazenamento com o que foi salvo.
        const raw = localStorage.getItem(WORKSPACE_KEY) ?? '';
        useWorkspace.setState(initialWorkspace());
        localStorage.setItem(WORKSPACE_KEY, raw);
        await reloadFromStorage();

        expect(workspace().projects.map((p) => p.data.name)).toEqual([
            '',
            'Sub',
        ]);
        expect(workspace().activeId).toBe(saved.activeId);
        expect(workspace().projects[0].plotted).toBe(false);
    });

    test('trocar o sistema de unidades limpa as unidades por campo de todos os projetos', () => {
        const id = workspace().activeId;
        projectStore(id).getState().setFieldUnit('vas_m3', 'ft3');
        workspace().openProject({
            ...createProjectData('B'),
            fieldUnits: { vb_m3: 'm3' },
        });

        usePreferences.getState().setUnitSystem('imperial');

        for (const project of workspace().projects) {
            expect(project.data.fieldUnits).toEqual({});
        }
        expect(projectStore(id).getState().data.fieldUnits).toEqual({});
    });

    test('storageProbe detecta armazenamento bloqueado', () => {
        expect(storageProbe()).toBe(true);
        expect(
            storageProbe(() => {
                throw new Error('bloqueado');
            }),
        ).toBe(false);
    });
});
