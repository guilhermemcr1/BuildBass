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

    test('a origem do driver copiado sobrevive ao recarregar', async () => {
        const id = workspace().activeId;
        const source = { brand: 'Triton', model: 'TR 620 12"', variant: '4 Ω' };
        projectStore(id)
            .getState()
            .applyCatalogDriver({ fs_hz: 76.94, qts: 0.717 }, source);

        const raw = localStorage.getItem(WORKSPACE_KEY) ?? '';
        useWorkspace.setState(initialWorkspace());
        localStorage.setItem(WORKSPACE_KEY, raw);
        await reloadFromStorage();

        const { data } = workspace().projects[0];
        expect(data.driverSource).toEqual(source);
        expect(data.driver).toEqual({ fs_hz: 76.94, qts: 0.717 });
    });

    test('o plano de corte sobrevive ao recarregar (feature 005)', async () => {
        const id = workspace().activeId;
        projectStore(id)
            .getState()
            .apply((data) => ({
                ...data,
                cutPlan: {
                    thickness_m: 0.025,
                    proportion: 'custom',
                    custom: { h: 2.2, w: 1.5, d: 1 },
                    braces_m3: 0.002,
                    cutout_m: 0.285,
                },
            }));

        const raw = localStorage.getItem(WORKSPACE_KEY) ?? '';
        useWorkspace.setState(initialWorkspace());
        localStorage.setItem(WORKSPACE_KEY, raw);
        await reloadFromStorage();

        expect(workspace().projects[0].data.cutPlan).toEqual({
            thickness_m: 0.025,
            proportion: 'custom',
            custom: { h: 2.2, w: 1.5, d: 1 },
            braces_m3: 0.002,
            cutout_m: 0.285,
        });
    });

    test('espaço de trabalho salvo antes do plano de corte reabre igual (feature 005)', async () => {
        const raw = localStorage.getItem(WORKSPACE_KEY) ?? '';

        useWorkspace.setState(initialWorkspace());
        localStorage.setItem(WORKSPACE_KEY, raw);
        await reloadFromStorage();

        expect(workspace().projects[0].data).not.toHaveProperty('cutPlan');
    });

    test('espaço de trabalho salvo antes da bandpass reabre igual (feature 004)', async () => {
        const closed = {
            ...createProjectData('Selada'),
            box: {
                type: 'closed',
                vb_m3: 0.05,
                ql: 7,
                port: { shape: 'round', count: 1 },
            },
        };
        const raw = localStorage.getItem(WORKSPACE_KEY) ?? '';
        const stored = JSON.parse(raw);
        stored.state.projects[0].data = closed;
        stored.version = 1;
        useWorkspace.setState(initialWorkspace());
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify(stored));
        await reloadFromStorage();

        const { data } = workspace().projects[0];
        expect(data.box.type).toBe('closed');
        expect(data.box.vb_m3).toBe(0.05);
        expect('vr_m3' in data.box).toBe(false);
        expect('vf_m3' in data.box).toBe(false);
    });

    test('projeto bandpass mantém as câmaras ao recarregar (feature 004)', async () => {
        const id = workspace().activeId;
        const store = projectStore(id).getState();
        store.setBoxValue('vb_m3', 0.05);
        store.setBoxType('bandpass');

        const raw = localStorage.getItem(WORKSPACE_KEY) ?? '';
        useWorkspace.setState(initialWorkspace());
        localStorage.setItem(WORKSPACE_KEY, raw);
        await reloadFromStorage();

        expect(workspace().projects[0].data.box).toMatchObject({
            type: 'bandpass',
            vr_m3: 0.05,
            vf_m3: 0.05,
        });
    });

    test('projeto bandpass 6ª ordem mantém câmaras, sintonias e dutos ao recarregar (feature 007)', async () => {
        const id = workspace().activeId;
        const store = projectStore(id).getState();
        store.setBoxValue('vb_m3', 0.05);
        store.setBoxType('bandpass6');
        store.setBoxValue('fb_rear_hz', 30);
        store.setPortRear({ shape: 'round', diameter_m: 0.07, count: 2 });

        const raw = localStorage.getItem(WORKSPACE_KEY) ?? '';
        useWorkspace.setState(initialWorkspace());
        localStorage.setItem(WORKSPACE_KEY, raw);
        await reloadFromStorage();

        expect(workspace().projects[0].data.box).toMatchObject({
            type: 'bandpass6',
            vr_m3: 0.05,
            vf_m3: 0.05,
            fb_rear_hz: 30,
            port_rear: { shape: 'round', diameter_m: 0.07, count: 2 },
        });
    });

    test('espaço de trabalho salvo antes da 6ª ordem (sem os campos novos) reabre igual (feature 007)', async () => {
        const before = {
            ...createProjectData('Bandpass 4'),
            box: {
                type: 'bandpass',
                vr_m3: 0.04,
                vf_m3: 0.06,
                ql: 7,
                fb_hz: 45,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            },
        };
        const raw = localStorage.getItem(WORKSPACE_KEY) ?? '';
        const stored = JSON.parse(raw);
        stored.state.projects[0].data = before;
        useWorkspace.setState(initialWorkspace());
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify(stored));
        await reloadFromStorage();

        const { data } = workspace().projects[0];
        expect(data.box.type).toBe('bandpass');
        expect(data.box.fb_hz).toBe(45);
        expect('fb_rear_hz' in data.box).toBe(false);
        expect('port_rear' in data.box).toBe(false);
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
