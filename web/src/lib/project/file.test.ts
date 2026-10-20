import { describe, expect, test } from 'vite-plus/test';
import {
    MAX_FILE_BYTES,
    exportFileName,
    parseProjectFile,
    serializeProject,
} from './file';
import { createProjectData } from './types';
import type { ProjectData } from './types';

const FULL: ProjectData = {
    name: 'Sub 12" dutado',
    driver: {
        fs_hz: 28,
        qts: 0.38,
        qes: 0.42,
        qms: 4.1,
        vas_m3: 0.085,
        re_ohm: 3.6,
        le_h: 0.0021,
        xmax_m: 0.014,
        sd_m2: 0.0491,
        pe_w: 500,
        bl_tm: 14,
        mms_kg: 0.13,
        vd_m3: 0.0035,
    },
    drivers: { count: 2, wiring: 'series' },
    box: {
        type: 'vented',
        vb_m3: 0.06,
        ql: 7,
        fb_hz: 32,
        port: { shape: 'rect', width_m: 0.05, height_m: 0.3, count: 1 },
    },
    signal: { mode: 'voltage', power_w: 1, voltage_v: 8, radiation: 'full' },
    fieldUnits: { vas_m3: 'ft3', vb_m3: 'L' },
};

function file(content: string, name = 'p.buildbass.json') {
    return new File([content], name, { type: 'application/json' });
}

function envelope(project: unknown, extra: Record<string, unknown> = {}) {
    return JSON.stringify({
        format: 'buildbass.project',
        version: 1,
        project,
        ...extra,
    });
}

describe('arquivo de projeto', () => {
    test('ida e volta reproduz todos os campos (SC-003)', async () => {
        const result = await parseProjectFile(file(serializeProject(FULL)));

        expect(result).toEqual({ ok: true, data: FULL });
    });

    test('projeto novo também volta igual', async () => {
        const data = createProjectData('');
        const result = await parseProjectFile(file(serializeProject(data)));

        expect(result).toEqual({ ok: true, data });
    });

    test('arquivo grande demais é recusado antes de ler', async () => {
        const big = file(' '.repeat(MAX_FILE_BYTES + 1));

        expect(await parseProjectFile(big)).toEqual({
            ok: false,
            code: 'fileTooLarge',
        });
    });

    test('JSON inválido', async () => {
        expect(await parseProjectFile(file('{nope'))).toEqual({
            ok: false,
            code: 'invalidJson',
        });
    });

    test('outro formato', async () => {
        expect(
            await parseProjectFile(file(JSON.stringify({ format: 'x' }))),
        ).toEqual({ ok: false, code: 'notBuildbass' });
        expect(await parseProjectFile(file('[1, 2]'))).toEqual({
            ok: false,
            code: 'notBuildbass',
        });
    });

    test('versão mais nova', async () => {
        expect(
            await parseProjectFile(file(envelope({}, { version: 2 }))),
        ).toEqual({ ok: false, code: 'newerVersion' });
    });

    test('conteúdo inválido aponta o caminho do primeiro erro', async () => {
        const wrongType = { ...FULL, driver: { fs_hz: 'vinte' } };
        const outOfRange = {
            ...FULL,
            box: { ...FULL.box, port: { shape: 'round', count: 9 } },
        };

        expect(await parseProjectFile(file(envelope(wrongType)))).toEqual({
            ok: false,
            code: 'invalidContent',
            path: 'project.driver.fs_hz',
        });
        expect(await parseProjectFile(file(envelope(outOfRange)))).toEqual({
            ok: false,
            code: 'invalidContent',
            path: 'project.box.port.count',
        });
    });

    test('campos desconhecidos são ignorados e unidades incompatíveis descartadas', async () => {
        const result = await parseProjectFile(
            file(
                envelope(
                    {
                        ...FULL,
                        color: 'red',
                        driver: { ...FULL.driver, extra: 1 },
                        fieldUnits: { vas_m3: 'ft3', fs_hz: 'mm', nope: 'L' },
                    },
                    { app: '9.9.9' },
                ),
            ),
        );

        expect(result).toEqual({
            ok: true,
            data: { ...FULL, fieldUnits: { vas_m3: 'ft3' } },
        });
    });
});

describe('nome do arquivo exportado', () => {
    test('minúsculas, sem acentos e símbolos', () => {
        expect(exportFileName('Sub 12" dutado')).toBe(
            'sub-12-dutado.buildbass.json',
        );
        expect(exportFileName('  Caixa Ônix — 2  ')).toBe(
            'caixa-onix-2.buildbass.json',
        );
    });

    test('nome vazio', () => {
        expect(exportFileName('')).toBe('projeto.buildbass.json');
        expect(exportFileName('***')).toBe('projeto.buildbass.json');
    });
});
