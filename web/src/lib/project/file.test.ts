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
            await parseProjectFile(file(envelope({}, { version: 3 }))),
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

describe('origem do driver (feature 003)', () => {
    const SOURCE = { brand: 'Triton', model: 'TR 620 12"', variant: '4 Ω' };

    test('ida e volta preserva driverSource', async () => {
        const data: ProjectData = { ...FULL, driverSource: SOURCE };
        const result = await parseProjectFile(file(serializeProject(data)));

        expect(result).toEqual({ ok: true, data });
    });

    test('driverSource sem variação também volta igual', async () => {
        const data: ProjectData = {
            ...FULL,
            driverSource: { brand: 'Triton', model: 'TR 620' },
        };
        const result = await parseProjectFile(file(serializeProject(data)));

        expect(result).toEqual({ ok: true, data });
    });

    test('arquivo da feature 002 (sem o campo) abre sem origem', async () => {
        const result = await parseProjectFile(file(envelope(FULL)));

        expect(result.ok).toBe(true);
        expect(result.ok && 'driverSource' in result.data).toBe(false);
    });

    test.each([
        ['marca vazia', { ...SOURCE, brand: '' }, 'project.driverSource.brand'],
        [
            'modelo com mais de 80 caracteres',
            { ...SOURCE, model: 'x'.repeat(81) },
            'project.driverSource.model',
        ],
        [
            'variação numérica',
            { ...SOURCE, variant: 4 },
            'project.driverSource.variant',
        ],
    ])('%s é recusada com o caminho', async (_name, driverSource, path) => {
        const result = await parseProjectFile(
            file(envelope({ ...FULL, driverSource })),
        );

        expect(result).toEqual({ ok: false, code: 'invalidContent', path });
    });

    test('campo desconhecido dentro de driverSource é ignorado', async () => {
        const result = await parseProjectFile(
            file(
                envelope({
                    ...FULL,
                    driverSource: { ...SOURCE, id: 7 },
                }),
            ),
        );

        expect(result).toEqual({
            ok: true,
            data: { ...FULL, driverSource: SOURCE },
        });
    });
});

describe('bandpass e versão 2 (feature 004)', () => {
    const BANDPASS: ProjectData = {
        ...FULL,
        name: 'Sub bandpass',
        box: {
            type: 'bandpass',
            vb_m3: 0.06,
            vr_m3: 0.04,
            vf_m3: 0.03,
            ql: 7,
            fb_hz: 45,
            port: { shape: 'round', diameter_m: 0.1, count: 1 },
        },
        fieldUnits: { vr_m3: 'L', vf_m3: 'ft3' },
    };

    function versionOf(text: string): number {
        return JSON.parse(text).version;
    }

    test('só a bandpass grava a versão 2', () => {
        expect(versionOf(serializeProject(BANDPASS))).toBe(2);
        expect(versionOf(serializeProject(FULL))).toBe(1);
        expect(versionOf(serializeProject(createProjectData('')))).toBe(1);
    });

    test('ida e volta da bandpass reproduz câmaras e unidades', async () => {
        const result = await parseProjectFile(file(serializeProject(BANDPASS)));

        expect(result).toEqual({ ok: true, data: BANDPASS });
    });

    test('abre arquivos das versões 1 e 2', async () => {
        const v1 = await parseProjectFile(file(envelope(FULL)));
        const v2 = await parseProjectFile(
            file(envelope(BANDPASS, { version: 2 })),
        );

        expect(v1).toEqual({ ok: true, data: FULL });
        expect(v2).toEqual({ ok: true, data: BANDPASS });
    });

    test('versão 1 com tipo bandpass também abre', async () => {
        const result = await parseProjectFile(file(envelope(BANDPASS)));

        expect(result).toEqual({ ok: true, data: BANDPASS });
    });

    test('bandpass sem câmaras nem Fb abre (os gráficos dizem o que falta)', async () => {
        const incomplete = {
            ...BANDPASS,
            box: {
                type: 'bandpass',
                ql: 7,
                port: BANDPASS.box.port,
            },
        };
        const result = await parseProjectFile(
            file(envelope(incomplete, { version: 2 })),
        );

        expect(result).toEqual({ ok: true, data: incomplete });
    });

    test('volume fora da faixa é recusado com o caminho', async () => {
        const result = await parseProjectFile(
            file(
                envelope(
                    { ...BANDPASS, box: { ...BANDPASS.box, vr_m3: 50 } },
                    { version: 2 },
                ),
            ),
        );

        expect(result).toEqual({
            ok: false,
            code: 'invalidContent',
            path: 'project.box.vr_m3',
        });
    });

    test('volume que não é número é recusado com o caminho', async () => {
        const result = await parseProjectFile(
            file(
                envelope(
                    { ...BANDPASS, box: { ...BANDPASS.box, vf_m3: '30 L' } },
                    { version: 2 },
                ),
            ),
        );

        expect(result).toEqual({
            ok: false,
            code: 'invalidContent',
            path: 'project.box.vf_m3',
        });
    });

    test('tipo de caixa desconhecido continua recusado', async () => {
        const result = await parseProjectFile(
            file(
                envelope({
                    ...FULL,
                    box: { ...FULL.box, type: 'horn' },
                }),
            ),
        );

        expect(result).toEqual({
            ok: false,
            code: 'invalidContent',
            path: 'project.box.type',
        });
    });
});
