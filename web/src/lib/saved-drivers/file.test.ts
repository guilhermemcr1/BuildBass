import { describe, expect, test } from 'vite-plus/test';
import {
    DRIVERS_FILE_FORMAT,
    DRIVERS_FILE_NAME,
    exportSavedDrivers,
    parseSavedDriversFile,
} from './file';
import type { SavedDriver, SavedDriverDraft } from './types';
import { SAVED_DRIVERS_MAX, SAVED_DRIVERS_MAX_BYTES } from './types';

function draft(model: string): SavedDriverDraft {
    return {
        brand: 'Marca',
        model,
        driver: { fs_hz: 32, qts: 0.42, vas_m3: 0.09 },
        nominal_diameter_m: 0.31,
        cutout_m: 0.285,
        depth_m: 0.15,
    };
}

function saved(model: string): SavedDriver {
    return {
        ...draft(model),
        id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        savedAt: '2026-10-21T12:00:00.000Z',
    };
}

function fileOf(content: unknown): File {
    const text =
        typeof content === 'string' ? content : JSON.stringify(content);

    return new File([text], DRIVERS_FILE_NAME, { type: 'application/json' });
}

function wrap(drivers: unknown, extra: Record<string, unknown> = {}) {
    return { format: DRIVERS_FILE_FORMAT, version: 1, drivers, ...extra };
}

describe('arquivo de alto-falantes salvos', () => {
    test('exporta sem id nem savedAt e reimporta igual', async () => {
        const text = exportSavedDrivers([saved('A'), saved('B')]);
        const raw = JSON.parse(text);

        expect(raw.format).toBe(DRIVERS_FILE_FORMAT);
        expect(raw.version).toBe(1);
        expect(raw.drivers).toHaveLength(2);
        expect(raw.drivers[0]).not.toHaveProperty('id');
        expect(raw.drivers[0]).not.toHaveProperty('savedAt');

        const result = await parseSavedDriversFile(fileOf(text));

        expect(result).toEqual({
            ok: true,
            drivers: [draft('A'), draft('B')],
        });
    });

    test('lista vazia é um arquivo válido', async () => {
        const result = await parseSavedDriversFile(fileOf(wrap([])));

        expect(result).toEqual({ ok: true, drivers: [] });
    });

    test('rejeita arquivo maior que o limite sem ler o conteúdo', async () => {
        const big = new File(
            ['x'.repeat(SAVED_DRIVERS_MAX_BYTES + 1)],
            'a.json',
        );

        expect(await parseSavedDriversFile(big)).toEqual({
            ok: false,
            code: 'fileTooLarge',
        });
    });

    test('rejeita JSON inválido', async () => {
        expect(await parseSavedDriversFile(fileOf('{ não é json'))).toEqual({
            ok: false,
            code: 'invalidJson',
        });
    });

    test('rejeita arquivo que não é do BuildBass (ex.: arquivo de projeto)', async () => {
        const project = {
            format: 'buildbass.project',
            version: 5,
            project: {},
        };

        expect(await parseSavedDriversFile(fileOf(project))).toEqual({
            ok: false,
            code: 'notBuildbass',
        });
        expect(await parseSavedDriversFile(fileOf([1, 2]))).toEqual({
            ok: false,
            code: 'notBuildbass',
        });
    });

    test('rejeita versão mais nova e versão malformada', async () => {
        expect(
            await parseSavedDriversFile(fileOf(wrap([], { version: 2 }))),
        ).toEqual({ ok: false, code: 'newerVersion' });
        expect(
            await parseSavedDriversFile(fileOf(wrap([], { version: 'um' }))),
        ).toEqual({ ok: false, code: 'invalidContent', path: 'version' });
    });

    test('recusa mais de 200 itens antes de validar', async () => {
        const many = Array.from({ length: SAVED_DRIVERS_MAX + 1 }, (_, index) =>
            draft(`M${index}`),
        );

        expect(await parseSavedDriversFile(fileOf(wrap(many)))).toEqual({
            ok: false,
            code: 'tooMany',
        });
    });

    test('aponta o caminho do primeiro campo inválido', async () => {
        const bad = {
            ...draft('B'),
            driver: { fs_hz: -3, qts: 0.4, vas_m3: 0.1 },
        };
        const result = await parseSavedDriversFile(
            fileOf(wrap([draft('A'), bad])),
        );

        expect(result.ok).toBe(false);

        if (!result.ok) {
            expect(result.code).toBe('invalidContent');
            expect(result.path).toBe('drivers.1.driver.fs_hz');
        }
    });

    test('rejeita item sem modelo e medida física fora da faixa', async () => {
        const noModel = { ...draft('A'), model: '' };
        const tooBig = { ...draft('A'), nominal_diameter_m: 9 };

        const first = await parseSavedDriversFile(fileOf(wrap([noModel])));
        const second = await parseSavedDriversFile(fileOf(wrap([tooBig])));

        expect(first).toMatchObject({ ok: false, path: 'drivers.0.model' });
        expect(second).toMatchObject({
            ok: false,
            path: 'drivers.0.nominal_diameter_m',
        });
    });

    test('drivers ausente ou não-lista é conteúdo inválido', async () => {
        const result = await parseSavedDriversFile(
            fileOf({ format: DRIVERS_FILE_FORMAT, version: 1 }),
        );

        expect(result).toMatchObject({ ok: false, code: 'invalidContent' });
    });
});
