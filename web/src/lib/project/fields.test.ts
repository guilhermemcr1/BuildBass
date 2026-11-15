import { expect, test } from 'vite-plus/test';
import type { ParameterKey } from '@/lib/parameters';
import { PROPORTIONS } from '@/cutplan';
import {
    clearCutoutPosition,
    clearPiecePositions,
    setCutMode,
    setCutoutPosition,
    setStock,
    readField,
    withIdentity,
    writeDimension,
    writeDriverChoice,
    writeField,
    writeProportion,
} from './fields';
import { createProjectData } from './types';

test('cada campo da bancada é lido e escrito no lugar certo do projeto', () => {
    const cases: [ParameterKey, number][] = [
        ['fs_hz', 28],
        ['vd_m3', 0.002],
        ['vb_m3', 0.05],
        ['vr_m3', 0.04],
        ['vf_m3', 0.06],
        ['fb_hz', 32],
        ['fb_rear_hz', 24],
        ['ql', 10],
        ['diameter_m', 0.08],
        ['port_count', 2],
        ['rear_diameter_m', 0.1],
        ['rear_port_count', 3],
        ['driver_count', 3],
        ['power_w', 100],
        ['voltage_v', 2.83],
        ['drv_a_m', 0.308],
        ['drv_b_m', 0.283],
        ['drv_d_m', 0.2],
        ['drv_e_m', 0.08],
        ['drv_f_m', 0.01],
        ['drv_g_m', 0.16],
    ];

    for (const [key, value] of cases) {
        const data = writeField(createProjectData(''), key, value);
        expect(readField(data, key), key).toBe(value);
    }
});

test('apagar um campo remove o valor digitado', () => {
    const data = writeField(createProjectData(''), 'fs_hz', 28);

    expect('fs_hz' in writeField(data, 'fs_hz', undefined).driver).toBe(false);
    expect(writeField(data, 'ql', undefined).box.ql).toBe(7);
});

test('escrever um campo do driver mantém a identificação, inclusive com o driver esvaziado', () => {
    const source = { brand: 'Triton', model: 'TR 620 12"' };
    const base = {
        ...writeField(
            writeField(createProjectData(''), 'fs_hz', 28),
            'qts',
            0.4,
        ),
        driverSource: source,
    };

    expect(writeField(base, 'vas_m3', 0.05).driverSource).toEqual(source);
    expect(writeField(base, 'fs_hz', undefined).driverSource).toEqual(source);

    const onlyFs = { ...base, driver: { fs_hz: 28 } };
    const emptied = writeField(onlyFs, 'fs_hz', undefined);

    expect(emptied.driver).toEqual({});
    expect(emptied.driverSource).toEqual(source);
});

test('withIdentity mescla partes, apaga as vazias e remove a identificação sem nada', () => {
    const base = createProjectData('');
    const named = withIdentity(base, { brand: 'Triton', model: ' TR 620 ' });

    expect(named.driverSource).toEqual({ brand: 'Triton', model: ' TR 620 ' });

    const typed = withIdentity(named, { type: 'subwoofer', variant: '4 Ω' });

    expect(typed.driverSource).toEqual({
        brand: 'Triton',
        model: ' TR 620 ',
        type: 'subwoofer',
        variant: '4 Ω',
    });
    expect(
        withIdentity(typed, { type: undefined, variant: '  ' }).driverSource,
    ).toEqual({ brand: 'Triton', model: ' TR 620 ' });
    expect(
        'driverSource' in withIdentity(named, { brand: '', model: undefined }),
    ).toBe(false);
});

test('campos que não são do driver não mexem na origem', () => {
    const source = { brand: 'Triton', model: 'TR 620 12"' };
    const data = { ...createProjectData(''), driverSource: source };

    expect(writeField(data, 'vb_m3', 0.05).driverSource).toEqual(source);
});

test('plano de corte: sem cutPlan, lê os valores efetivos (padrões)', () => {
    const data = createProjectData('');

    expect(readField(data, 'thickness_m')).toBe(0.018);
    expect(readField(data, 'braces_m3')).toBe(0);
    expect(readField(data, 'cutout_m')).toBeUndefined();
    expect(readField(data, 'ratio_h')).toBe(PROPORTIONS.golden.h);
    expect(readField(data, 'ratio_w')).toBe(PROPORTIONS.golden.w);
    expect(readField(data, 'ratio_d')).toBe(PROPORTIONS.golden.d);
});

test('plano de corte: escrever um campo cria cutPlan só com ele', () => {
    const data = writeField(createProjectData(''), 'thickness_m', 0.02);

    expect(data.cutPlan).toEqual({ thickness_m: 0.02 });
    expect(readField(data, 'thickness_m')).toBe(0.02);
    expect(writeField(data, 'cutout_m', 0.285).cutPlan).toEqual({
        thickness_m: 0.02,
        cutout_m: 0.285,
    });
});

test('plano de corte: esvaziar o último campo remove cutPlan e o projeto volta ao original', () => {
    const original = createProjectData('');
    const edited = writeField(original, 'braces_m3', 0.002);
    const cleared = writeField(edited, 'braces_m3', undefined);

    expect(edited.cutPlan).toEqual({ braces_m3: 0.002 });
    expect('cutPlan' in cleared).toBe(false);
    expect(cleared).toEqual(original);
});

test('plano de corte: esvaziar um campo mantém os outros', () => {
    const data = writeField(
        writeField(createProjectData(''), 'thickness_m', 0.02),
        'cutout_m',
        0.285,
    );

    expect(writeField(data, 'cutout_m', undefined).cutPlan).toEqual({
        thickness_m: 0.02,
    });
});

test('plano de corte: editar a razão grava proporção própria semeada com a razão atual', () => {
    const data = writeField(createProjectData(''), 'ratio_h', 3);

    expect(data.cutPlan).toEqual({
        proportion: 'custom',
        custom: { h: 3, w: PROPORTIONS.golden.w, d: PROPORTIONS.golden.d },
    });
    expect(readField(data, 'ratio_h')).toBe(3);
    expect(readField(data, 'ratio_w')).toBe(PROPORTIONS.golden.w);
});

test('plano de corte: esvaziar um lado da razão não muda nada', () => {
    const data = writeField(createProjectData(''), 'ratio_h', 3);

    expect(writeField(data, 'ratio_h', undefined)).toBe(data);
});

test('plano de corte: proporção própria parte da razão que estava ativa; sugestão mantém custom', () => {
    const base = writeField(createProjectData(''), 'thickness_m', 0.02);
    const louden = writeProportion(base, 'louden');
    const custom = writeProportion(louden, 'custom');

    expect(custom.cutPlan).toEqual({
        thickness_m: 0.02,
        proportion: 'custom',
        custom: PROPORTIONS.louden,
    });

    const edited = writeField(custom, 'ratio_d', 1.2);
    const cube = writeProportion(edited, 'cube');

    expect(cube.cutPlan?.proportion).toBe('cube');
    expect(cube.cutPlan?.custom).toEqual({
        h: PROPORTIONS.louden.h,
        w: PROPORTIONS.louden.w,
        d: 1.2,
    });
});

test('plano de corte: o resto do projeto fica intacto', () => {
    const original = writeField(createProjectData('Sub'), 'vb_m3', 0.06);
    const edited = writeProportion(
        writeField(original, 'thickness_m', 0.02),
        'cube',
    );

    expect({ ...edited, cutPlan: undefined }).toEqual({
        ...original,
        cutPlan: undefined,
    });
});

test('as medidas do duto traseiro ficam em port_rear e não mexem no duto frontal', () => {
    const base = writeField(createProjectData(''), 'diameter_m', 0.08);
    const data = writeField(
        writeField(base, 'rear_diameter_m', 0.12),
        'rear_port_count',
        2,
    );

    expect(data.box.port).toEqual(base.box.port);
    expect(data.box.port_rear).toEqual({
        shape: 'round',
        diameter_m: 0.12,
        count: 2,
    });
    expect(readField(data, 'diameter_m')).toBe(0.08);
    expect(readField(data, 'rear_diameter_m')).toBe(0.12);
    expect(readField(createProjectData(''), 'rear_diameter_m')).toBeUndefined();
    expect(readField(createProjectData(''), 'rear_port_count')).toBe(1);

    const cleared = writeField(data, 'rear_diameter_m', undefined);
    expect(readField(cleared, 'rear_diameter_m')).toBeUndefined();
    expect(readField(cleared, 'diameter_m')).toBe(0.08);
});

test('a unidade escolhida no duto traseiro é guardada à parte da do frontal', () => {
    const data = createProjectData('');
    data.fieldUnits = { rear_diameter_m: 'in' };

    expect(data.fieldUnits.rear_diameter_m).toBe('in');
    expect(data.fieldUnits.diameter_m).toBeUndefined();
});

test('writeDimension fixa a medida digitada, ajusta as outras duas e mantém o volume', () => {
    const internal = { h_m: 0.6, w_m: 0.4, d_m: 0.25 };
    const data = writeDimension(createProjectData(''), internal, 'h', 0.75);
    const { custom, proportion } = data.cutPlan ?? {};

    expect(proportion).toBe('custom');
    expect(custom?.d).toBe(1);

    // Ratio normalizada pela profundidade: escalada de volta, recupera as medidas e o volume.
    const volume = 0.6 * 0.4 * 0.25;
    const depth = Math.cbrt(volume / ((custom?.h ?? 0) * (custom?.w ?? 0)));
    const h = (custom?.h ?? 0) * depth;

    expect(h).toBeCloseTo(0.75, 9);
    expect(h * (custom?.w ?? 0) * depth * depth).toBeCloseTo(volume, 9);
});

test('writeDimension recusa medida que leva a razão para fora da faixa', () => {
    const data = createProjectData('');
    const internal = { h_m: 0.6, w_m: 0.4, d_m: 0.25 };

    expect(writeDimension(data, internal, 'h', 5)).toBe(data);
});

test('formato e medidas do alto-falante somem do projeto quando esvaziados', () => {
    const base = createProjectData('p');
    const shaped = writeDriverChoice(base, 'shape', 'square');
    const sized = writeField(shaped, 'drv_g_m', 0.16);

    expect(sized.driverDims).toEqual({ shape: 'square', g_m: 0.16 });
    expect(
        writeField(
            writeDriverChoice(sized, 'shape', undefined),
            'drv_g_m',
            undefined,
        ),
    ).toEqual(base);
});

test('estoque: a lista inteira vai para a raiz e `more`, preservando perda de serra e corte', () => {
    const base = createProjectData('p');
    const started = setCutMode(
        setStock(base, [{ w_m: 2.75, h_m: 1.85 }]),
        'free',
    );
    const kerfed = writeField(started, 'kerf_m', 0.004);
    const two = setStock(kerfed, [
        { w_m: 2.75, h_m: 1.85 },
        { w_m: 0.9, h_m: 0.6, quantity: 2 },
    ]);

    expect(two.cutPlan?.sheet).toEqual({
        w_m: 2.75,
        h_m: 1.85,
        kerf_m: 0.004,
        more: [{ w_m: 0.9, h_m: 0.6, quantity: 2 }],
        cut: 'free',
    });
    expect(setStock(two, []).cutPlan).toBeUndefined();
});

test('estoque: 1º item vazio com outro item preenchido mantém a chapa', () => {
    const data = setStock(createProjectData('p'), [{}, { w_m: 0.9, h_m: 0.6 }]);

    expect(data.cutPlan?.sheet).toEqual({ more: [{ w_m: 0.9, h_m: 0.6 }] });
    expect(writeField(data, 'sheet_w_m', undefined).cutPlan?.sheet).toEqual({
        more: [{ w_m: 0.9, h_m: 0.6 }],
    });
});

test('tipo de corte: "Serra" é o padrão e não fica gravado; sem chapa não muda nada', () => {
    const base = createProjectData('p');

    expect(setCutMode(base, 'free')).toBe(base);

    const sheet = setStock(base, [{ w_m: 2.75, h_m: 1.85 }]);

    expect(setCutMode(sheet, 'free').cutPlan?.sheet?.cut).toBe('free');
    expect(
        setCutMode(setCutMode(sheet, 'free'), 'guillotine').cutPlan?.sheet,
    ).toEqual({ w_m: 2.75, h_m: 1.85 });
});

test('posição dos recortes: grava, troca, limita às faixas e volta ao automático', () => {
    const driver = { piece: 'front', kind: 'driver', n: 1 } as const;
    const port = { piece: 'front', kind: 'port', n: 1 } as const;
    const rear = { piece: 'back', kind: 'port', n: 1 } as const;
    let data = setCutoutPosition(createProjectData('p'), driver, 0.2, 0.3);

    data = setCutoutPosition(data, driver, 0.25, -1);
    data = setCutoutPosition(data, port, 5, 0.1);
    data = setCutoutPosition(data, rear, 0.1, 0.1);

    expect(data.cutPlan?.positions).toEqual([
        { ...driver, x_m: 0.25, y_m: 0 },
        { ...port, x_m: 3, y_m: 0.1 },
        { ...rear, x_m: 0.1, y_m: 0.1 },
    ]);

    const front = clearPiecePositions(data, 'front');

    expect(front.cutPlan?.positions).toEqual([{ ...rear, x_m: 0.1, y_m: 0.1 }]);
    expect(clearCutoutPosition(front, rear).cutPlan).toBeUndefined();
});
