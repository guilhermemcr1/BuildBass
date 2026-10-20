import { describe, expect, test } from 'vite-plus/test';
import { createProjectData } from '@/lib/project/types';
import { createProjectStore } from './project-store';

function store() {
    return createProjectStore(createProjectData('Teste'), { groupMs: 0 });
}

describe('createProjectStore', () => {
    test('edita driver, caixa, duto, drivers, sinal, unidades e nome', () => {
        const project = store();
        const actions = project.getState();

        actions.setDriverValue('fs_hz', 28);
        actions.setBoxValue('vb_m3', 0.05);
        actions.setPort({
            shape: 'rect',
            width_m: 0.05,
            height_m: 0.2,
            count: 2,
        });
        actions.setDrivers({ count: 2 });
        actions.setSignal({ mode: 'voltage', voltage_v: 2.83 });
        actions.setFieldUnit('vas_m3', 'ft3');
        actions.setName('Sub');

        const { data } = project.getState();
        expect(data.driver.fs_hz).toBe(28);
        expect(data.box.vb_m3).toBe(0.05);
        expect(data.box.port).toEqual({
            shape: 'rect',
            width_m: 0.05,
            height_m: 0.2,
            count: 2,
        });
        expect(data.drivers).toEqual({ count: 2, wiring: 'parallel' });
        expect(data.signal).toMatchObject({
            mode: 'voltage',
            voltage_v: 2.83,
            radiation: 'half',
        });
        expect(data.fieldUnits.vas_m3).toBe('ft3');
        expect(data.name).toBe('Sub');

        actions.setDriverValue('fs_hz', undefined);
        expect('fs_hz' in project.getState().data.driver).toBe(false);

        actions.clearFieldUnits();
        expect(project.getState().data.fieldUnits).toEqual({});
    });

    test('trocar o tipo de caixa preserva Fb e o duto', () => {
        const project = store();
        project.getState().setBoxValue('fb_hz', 32);
        project.getState().setBoxType('closed');
        project.getState().setBoxType('vented');

        expect(project.getState().data.box.fb_hz).toBe(32);
        expect(project.getState().data.box.port.shape).toBe('round');
    });

    test('desfazer e refazer passo a passo', () => {
        const project = store();
        project.getState().setBoxValue('vb_m3', 0.05);
        project.getState().setBoxValue('fb_hz', 30);

        project.temporal.getState().undo();
        expect(project.getState().data.box.fb_hz).toBeUndefined();
        project.temporal.getState().undo();
        expect(project.getState().data.box.vb_m3).toBeUndefined();
        project.temporal.getState().redo(2);
        expect(project.getState().data.box).toMatchObject({
            vb_m3: 0.05,
            fb_hz: 30,
        });
    });

    test('apply muda vários campos numa única etapa', () => {
        const project = store();
        project.getState().apply((data) => ({
            ...data,
            box: { ...data.box, vb_m3: 0.06, fb_hz: 31 },
        }));

        expect(project.temporal.getState().pastStates).toHaveLength(1);
        project.temporal.getState().undo();
        expect(project.getState().data.box.vb_m3).toBeUndefined();
        expect(project.getState().data.box.fb_hz).toBeUndefined();
    });

    test('histórico limitado a 50 passos', () => {
        const project = store();

        for (let step = 1; step <= 60; step++) {
            project.getState().setDriverValue('fs_hz', step);
        }

        expect(project.temporal.getState().pastStates).toHaveLength(50);
    });

    test('mudanças rápidas seguidas viram um passo só', () => {
        const project = createProjectStore(createProjectData('Teste'));

        for (let step = 1; step <= 10; step++) {
            project.getState().setBoxValue('vb_m3', step / 100);
        }

        expect(project.temporal.getState().pastStates).toHaveLength(1);
    });
});
