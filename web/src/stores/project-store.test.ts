import { describe, expect, test } from 'vite-plus/test';
import { writeField, writeProportion } from '@/lib/project/fields';
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

    test('bandpass: câmaras nascem do Vb numa etapa só de desfazer', () => {
        const project = store();
        project.getState().setBoxValue('vb_m3', 0.05);
        const steps = project.temporal.getState().pastStates.length;

        project.getState().setBoxType('bandpass');

        expect(project.getState().data.box).toMatchObject({
            type: 'bandpass',
            vb_m3: 0.05,
            vr_m3: 0.05,
            vf_m3: 0.05,
        });
        expect(project.temporal.getState().pastStates).toHaveLength(steps + 1);

        project.temporal.getState().undo();
        expect(project.getState().data.box.type).toBe('vented');
        expect('vr_m3' in project.getState().data.box).toBe(false);
        expect('vf_m3' in project.getState().data.box).toBe(false);
    });

    test('bandpass: não sobrescreve câmaras já preenchidas', () => {
        const project = store();
        project.getState().apply((data) => ({
            ...data,
            box: { ...data.box, vb_m3: 0.05, vr_m3: 0.02 },
        }));
        project.getState().setBoxType('bandpass');

        expect(project.getState().data.box).toMatchObject({
            vr_m3: 0.02,
            vf_m3: 0.05,
        });
    });

    test('bandpass: sem Vb nada é criado', () => {
        const project = store();
        project.getState().setBoxType('bandpass');

        expect('vr_m3' in project.getState().data.box).toBe(false);
        expect('vf_m3' in project.getState().data.box).toBe(false);
    });

    test('bandpass 6ª ordem: semeia vr e vf do Vb, copia o duto e não semeia Fbr, numa etapa só', () => {
        const project = store();
        project.getState().setBoxValue('vb_m3', 0.05);
        project.getState().setPort({
            shape: 'rect',
            width_m: 0.05,
            height_m: 0.2,
            count: 2,
        });
        const steps = project.temporal.getState().pastStates.length;

        project.getState().setBoxType('bandpass6');

        const { box } = project.getState().data;
        expect(box).toMatchObject({
            type: 'bandpass6',
            vr_m3: 0.05,
            vf_m3: 0.05,
            port_rear: {
                shape: 'rect',
                width_m: 0.05,
                height_m: 0.2,
                count: 2,
            },
        });
        expect('fb_rear_hz' in box).toBe(false);
        expect(project.temporal.getState().pastStates).toHaveLength(steps + 1);

        project.temporal.getState().undo();
        expect(project.getState().data.box.type).toBe('vented');
        expect('port_rear' in project.getState().data.box).toBe(false);
        expect('vr_m3' in project.getState().data.box).toBe(false);
    });

    test('da bandpass de 4ª para a de 6ª ordem aproveita vr, vf, fb, duto e ql', () => {
        const project = store();
        project.getState().apply((data) => ({
            ...data,
            box: {
                ...data.box,
                type: 'bandpass',
                vr_m3: 0.08,
                vf_m3: 0.04,
                fb_hz: 45,
                ql: 9,
                port: { shape: 'round', diameter_m: 0.1, count: 1 },
            },
        }));

        project.getState().setBoxType('bandpass6');

        expect(project.getState().data.box).toMatchObject({
            type: 'bandpass6',
            vr_m3: 0.08,
            vf_m3: 0.04,
            fb_hz: 45,
            ql: 9,
            port: { shape: 'round', diameter_m: 0.1, count: 1 },
            port_rear: { shape: 'round', diameter_m: 0.1, count: 1 },
        });
    });

    test('bandpass 6ª ordem: não sobrescreve o duto traseiro nem Fbr já preenchidos', () => {
        const project = store();
        project.getState().setBoxType('bandpass6');
        project.getState().setBoxValue('fb_rear_hz', 30);
        project.getState().setPortRear({
            shape: 'round',
            diameter_m: 0.07,
            count: 3,
        });

        project.getState().setBoxType('vented');
        project.getState().setBoxType('bandpass6');

        expect(project.getState().data.box).toMatchObject({
            fb_rear_hz: 30,
            port_rear: { shape: 'round', diameter_m: 0.07, count: 3 },
        });
    });

    test('setPortRear só mexe no duto traseiro', () => {
        const project = store();
        const front = project.getState().data.box.port;

        project.getState().setPortRear({ shape: 'round', count: 2 });

        expect(project.getState().data.box.port).toBe(front);
        expect(project.getState().data.box.port_rear).toEqual({
            shape: 'round',
            count: 2,
        });
    });

    test('trocar de volta preserva os campos de todos os tipos', () => {
        const project = store();
        project.getState().setBoxValue('vb_m3', 0.05);
        project.getState().setBoxValue('fb_hz', 32);
        project.getState().setBoxType('bandpass6');
        project.getState().setBoxValue('fb_rear_hz', 28);
        project.getState().setBoxType('closed');
        project.getState().setBoxType('bandpass');
        project.getState().setBoxType('vented');

        expect(project.getState().data.box).toMatchObject({
            type: 'vented',
            vb_m3: 0.05,
            vr_m3: 0.05,
            vf_m3: 0.05,
            fb_hz: 32,
            fb_rear_hz: 28,
        });
        expect(project.getState().data.box.port_rear).toBeDefined();
    });

    test('alternar entre os três tipos preserva os campos de cada um', () => {
        const project = store();
        project.getState().setBoxValue('vb_m3', 0.05);
        project.getState().setBoxValue('fb_hz', 32);
        project.getState().setPort({
            shape: 'rect',
            width_m: 0.05,
            height_m: 0.2,
            count: 1,
        });
        project.getState().setBoxType('bandpass');
        project.getState().setBoxType('closed');
        project.getState().setBoxType('vented');

        expect(project.getState().data.box).toMatchObject({
            type: 'vented',
            vb_m3: 0.05,
            vr_m3: 0.05,
            vf_m3: 0.05,
            fb_hz: 32,
            port: { shape: 'rect', width_m: 0.05, height_m: 0.2, count: 1 },
        });
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

describe('applyCatalogDriver com medidas físicas', () => {
    const SOURCE = { brand: 'Triton', model: 'TR 620 12"' };
    const CATALOG = { fs_hz: 76.94, qts: 0.717, vas_m3: 0.026348 };
    const DIMS = {
        shape: 'round' as const,
        piston: 'cone' as const,
        measures: { drv_a_m: 0.32, drv_g_m: 0.14, cutout_m: 0.28 },
    };

    test('grava formato, pistão e cotas, com o recorte no plano de corte', () => {
        const project = store();

        project.getState().applyCatalogDriver(CATALOG, SOURCE, DIMS);

        const { data } = project.getState();
        expect(data.driverDims).toEqual({
            shape: 'round',
            piston: 'cone',
            a_m: 0.32,
            g_m: 0.14,
        });
        expect(data.cutPlan?.cutout_m).toBe(0.28);
    });

    test('substitui as cotas de outro alto-falante em vez de misturar', () => {
        const project = store();
        project.getState().applyCatalogDriver(CATALOG, SOURCE, {
            shape: 'square',
            measures: { drv_a_m: 0.5, drv_e_m: 0.09 },
        });

        project.getState().applyCatalogDriver(CATALOG, SOURCE, DIMS);

        expect(project.getState().data.driverDims).not.toHaveProperty('e_m');
        expect(project.getState().data.driverDims?.shape).toBe('round');
    });

    test('sem medidas no cadastro, as do anterior saem em vez de ficar', () => {
        const project = store();
        project.getState().applyCatalogDriver(CATALOG, SOURCE, DIMS);

        project.getState().applyCatalogDriver(CATALOG, SOURCE);

        expect(project.getState().data.driverDims).toBeUndefined();
        expect(project.getState().data.cutPlan?.cutout_m).toBeUndefined();
    });

    test('o recorte do anterior sai quando o novo traz cotas sem recorte', () => {
        const project = store();
        project.getState().applyCatalogDriver(CATALOG, SOURCE, DIMS);

        project.getState().applyCatalogDriver(CATALOG, SOURCE, {
            measures: { drv_a_m: 0.4 },
        });

        expect(project.getState().data.cutPlan?.cutout_m).toBeUndefined();
        expect(project.getState().data.driverDims).toEqual({ a_m: 0.4 });
    });

    test('parâmetro que falta no novo fica em branco, sem herdar do anterior', () => {
        const project = store();
        project
            .getState()
            .applyCatalogDriver({ ...CATALOG, re_ohm: 3, bl_tm: 10.9 }, SOURCE);

        project.getState().applyCatalogDriver(CATALOG, SOURCE);

        expect(project.getState().data.driver).toEqual(CATALOG);
    });

    test('a ligação das bobinas do anterior não passa para o novo', () => {
        const project = store();
        project.getState().setDrivers({ coil_wiring: 'parallel' });

        project.getState().applyCatalogDriver(CATALOG, SOURCE);

        expect(project.getState().data.drivers).not.toHaveProperty(
            'coil_wiring',
        );
    });

    test('é uma etapa só de desfazer', () => {
        const project = store();
        const steps = project.temporal.getState().pastStates.length;

        project.getState().applyCatalogDriver(CATALOG, SOURCE, DIMS);

        expect(project.temporal.getState().pastStates).toHaveLength(steps + 1);
    });
});

describe('applyCatalogDriver', () => {
    const SOURCE = { brand: 'Triton', model: 'TR 620 12"', variant: '4 Ω' };
    const CATALOG = { fs_hz: 76.94, qts: 0.717, vas_m3: 0.026348 };

    test('troca o driver por inteiro e define a origem', () => {
        const project = store();
        project.getState().setDriverValue('xmax_m', 0.01);
        project.getState().setDriverValue('fs_hz', 30);

        project.getState().applyCatalogDriver(CATALOG, SOURCE);

        const { data } = project.getState();
        expect(data.driver).toEqual(CATALOG);
        expect(data.driver).not.toHaveProperty('xmax_m');
        expect(data.driverSource).toEqual(SOURCE);
    });

    test('não mexe no resto do projeto', () => {
        const project = store();
        project.getState().setName('Sub');
        project.getState().setDrivers({ count: 2, wiring: 'series' });
        project.getState().setBoxValue('vb_m3', 0.05);
        project.getState().setSignal({ power_w: 100 });
        project.getState().setFieldUnit('vas_m3', 'ft3');
        const before = project.getState().data;

        project.getState().applyCatalogDriver(CATALOG, SOURCE);

        const { driver, driverSource, ...rest } = project.getState().data;
        const { driver: _driver, ...expected } = before;
        expect(rest).toEqual(expected);
        expect(driver).toEqual(CATALOG);
        expect(driverSource).toEqual(SOURCE);
    });

    test('é uma etapa só: um undo restaura driver e origem', () => {
        const project = store();
        project.getState().setDriverValue('fs_hz', 30);
        const steps = project.temporal.getState().pastStates.length;

        project.getState().applyCatalogDriver(CATALOG, SOURCE);

        expect(project.temporal.getState().pastStates).toHaveLength(steps + 1);
        project.temporal.getState().undo();
        expect(project.getState().data.driver).toEqual({ fs_hz: 30 });
        expect(project.getState().data.driverSource).toBeUndefined();
        project.temporal.getState().redo();
        expect(project.getState().data.driver).toEqual(CATALOG);
    });

    test('só o projeto do store muda', () => {
        const first = store();
        const second = store();

        first.getState().applyCatalogDriver(CATALOG, SOURCE);

        expect(second.getState().data.driver).toEqual({});
        expect(second.getState().data.driverSource).toBeUndefined();
    });
});

describe('applySavedDriver', () => {
    const SAVED = {
        brand: 'Marca',
        model: 'Sub 12',
        variant: '4 Ω',
        driver: { fs_hz: 32, qts: 0.42, vas_m3: 0.09 },
        cutout_m: 0.285,
    };

    test('aplica driver, origem e recorte numa etapa só de desfazer', () => {
        const project = store();
        project.getState().setDriverValue('fs_hz', 30);
        const steps = project.temporal.getState().pastStates.length;

        project.getState().applySavedDriver(SAVED);

        const { data } = project.getState();
        expect(data.driver).toEqual(SAVED.driver);
        expect(data.driverSource).toEqual({
            brand: 'Marca',
            model: 'Sub 12',
            variant: '4 Ω',
        });
        expect(data.cutPlan?.cutout_m).toBe(0.285);
        expect(project.temporal.getState().pastStates).toHaveLength(steps + 1);

        project.temporal.getState().undo();
        expect(project.getState().data.driver).toEqual({ fs_hz: 30 });
        expect(project.getState().data.driverSource).toBeUndefined();
        expect(project.getState().data.cutPlan).toBeUndefined();
    });

    test('sem recorte salvo, o recorte anterior sai em vez de ficar', () => {
        const project = store();
        project.getState().apply((data) => ({
            ...data,
            cutPlan: { cutout_m: 0.2 },
        }));
        const { cutout_m: _cutout, ...withoutCutout } = SAVED;

        project.getState().applySavedDriver(withoutCutout);

        expect(project.getState().data.cutPlan?.cutout_m).toBeUndefined();
        expect(project.getState().data.driverSource).toEqual({
            brand: 'Marca',
            model: 'Sub 12',
            variant: '4 Ω',
        });
    });

    test('origem sem variante não leva a chave variant', () => {
        const project = store();
        const { variant: _variant, ...noVariant } = SAVED;

        project.getState().applySavedDriver(noVariant);

        expect(project.getState().data.driverSource).toEqual({
            brand: 'Marca',
            model: 'Sub 12',
        });
    });
});

describe('origem do driver e edição manual', () => {
    const SOURCE = { brand: 'Triton', model: 'TR 620 12"' };

    test('editar um parâmetro mantém a origem', () => {
        const project = store();
        project.getState().applyCatalogDriver({ fs_hz: 76, qts: 0.7 }, SOURCE);

        project.getState().setDriverValue('qts', 0.5);

        expect(project.getState().data.driverSource).toEqual(SOURCE);
    });

    test('apagar o último valor do driver mantém a identificação, que agora é visível e editável', () => {
        const project = store();
        project.getState().applyCatalogDriver({ fs_hz: 76 }, SOURCE);

        project.getState().setDriverValue('fs_hz', undefined);

        expect(project.getState().data.driverSource).toEqual(SOURCE);
    });

    test('setDriverIdentity edita as partes, apaga as vazias e desfaz numa etapa', () => {
        const project = store();

        project
            .getState()
            .setDriverIdentity({ brand: 'Triton', type: 'subwoofer' });
        expect(project.getState().data.driverSource).toEqual({
            brand: 'Triton',
            type: 'subwoofer',
        });

        project.getState().setDriverIdentity({ type: undefined });
        expect(project.getState().data.driverSource).toEqual({
            brand: 'Triton',
        });

        project.getState().setDriverIdentity({ brand: '' });
        expect('driverSource' in project.getState().data).toBe(false);

        project.temporal.getState().undo();
        expect(project.getState().data.driverSource).toEqual({
            brand: 'Triton',
        });
    });

    test('aplicar um salvo traz o tipo junto', () => {
        const project = store();

        project.getState().applySavedDriver({
            brand: 'Triton',
            model: 'TR 620',
            type: 'woofer',
            driver: { fs_hz: 76 },
        });

        expect(project.getState().data.driverSource).toEqual({
            brand: 'Triton',
            model: 'TR 620',
            type: 'woofer',
        });
    });

    test('apagar um valor com outros presentes mantém a origem', () => {
        const project = store();
        project.getState().applyCatalogDriver({ fs_hz: 76, qts: 0.7 }, SOURCE);

        project.getState().setDriverValue('fs_hz', undefined);

        expect(project.getState().data.driverSource).toEqual(SOURCE);
    });
});

describe('plano de corte no store', () => {
    test('editar um campo do plano é uma etapa de desfazer e refazer', () => {
        const project = store();
        project
            .getState()
            .apply((data) => writeField(data, 'thickness_m', 0.025));

        expect(project.getState().data.cutPlan).toEqual({ thickness_m: 0.025 });
        expect(project.temporal.getState().pastStates).toHaveLength(1);

        project.temporal.getState().undo();
        // Voltar ao início desfaz o cutPlan inteiro, não deixa um objeto vazio.
        expect(project.getState().data.cutPlan).toBeUndefined();
        expect(project.getState().data).not.toHaveProperty('cutPlan');

        project.temporal.getState().redo();
        expect(project.getState().data.cutPlan).toEqual({ thickness_m: 0.025 });
    });

    test('trocar a proporção e editar o recorte são etapas separadas', () => {
        const project = store();
        project.getState().apply((data) => writeProportion(data, 'louden'));
        project.getState().apply((data) => writeField(data, 'cutout_m', 0.285));

        project.temporal.getState().undo();
        expect(project.getState().data.cutPlan).toEqual({
            proportion: 'louden',
        });
        project.temporal.getState().undo();
        expect(project.getState().data.cutPlan).toBeUndefined();
    });

    test('não mexe no resto do projeto', () => {
        const project = store();
        project.getState().setBoxValue('vb_m3', 0.06);
        const before = project.getState().data;
        project
            .getState()
            .apply((data) => writeField(data, 'braces_m3', 0.002));

        expect(project.getState().data.box).toBe(before.box);
        expect(project.getState().data.driver).toBe(before.driver);
    });

    test('esvaziar o único campo remove o cutPlan', () => {
        const project = store();
        project
            .getState()
            .apply((data) => writeField(data, 'thickness_m', 0.025));
        project
            .getState()
            .apply((data) => writeField(data, 'thickness_m', undefined));

        expect(project.getState().data).not.toHaveProperty('cutPlan');
    });
});
