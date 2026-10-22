import { describe, expect, test } from 'vite-plus/test';
import { CURRENT_VERSION } from './migrate';
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
            await parseProjectFile(file(envelope({}, { version: 6 }))),
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

describe('plano de corte no arquivo (versão 3)', () => {
    const PLAN: ProjectData = {
        ...FULL,
        cutPlan: {
            thickness_m: 0.025,
            proportion: 'custom',
            custom: { h: 2.2, w: 1.5, d: 1 },
            braces_m3: 0.002,
            cutout_m: 0.285,
        },
    };

    const versionOf = (text: string): number => JSON.parse(text).version;

    const withPlan = (cutPlan: unknown) =>
        file(envelope({ ...FULL, cutPlan }, { version: 3 }));

    test('grava a versão 3 só com cutPlan; bandpass sem plano é 2 e o resto é 1', () => {
        expect(versionOf(serializeProject(PLAN))).toBe(3);
        expect(
            versionOf(
                serializeProject({
                    ...PLAN,
                    box: { ...PLAN.box, type: 'bandpass' },
                }),
            ),
        ).toBe(3);
        expect(
            versionOf(
                serializeProject({
                    ...FULL,
                    box: { ...FULL.box, type: 'bandpass' },
                }),
            ),
        ).toBe(2);
        expect(versionOf(serializeProject(FULL))).toBe(1);
    });

    test('ida e volta de um plano completo reproduz tudo', async () => {
        const result = await parseProjectFile(file(serializeProject(PLAN)));

        expect(result).toEqual({ ok: true, data: PLAN });
    });

    test('sem cutPlan o arquivo não ganha a chave', () => {
        expect(JSON.parse(serializeProject(FULL)).project).not.toHaveProperty(
            'cutPlan',
        );
    });

    test('abre as versões 1, 2 e 3', async () => {
        for (const version of [1, 2, 3]) {
            expect(
                await parseProjectFile(file(envelope(FULL, { version }))),
            ).toEqual({ ok: true, data: FULL });
        }
    });

    test('um arquivo v1 ou v2 com cutPlan também é validado e aceito', async () => {
        for (const version of [1, 2]) {
            const result = await parseProjectFile(
                file(envelope(PLAN, { version })),
            );

            expect(result).toEqual({ ok: true, data: PLAN });
        }
    });

    test('valores fora da faixa são recusados com o caminho', async () => {
        const cases: [unknown, string][] = [
            [{ thickness_m: 0 }, 'project.cutPlan.thickness_m'],
            [{ braces_m3: 21 }, 'project.cutPlan.braces_m3'],
            [
                { proportion: 'custom', custom: { h: 0.05, w: 1, d: 1 } },
                'project.cutPlan.custom.h',
            ],
            [{ cutout_m: 0.01 }, 'project.cutPlan.cutout_m'],
            [{ proportion: 'horn' }, 'project.cutPlan.proportion'],
        ];

        for (const [cutPlan, path] of cases) {
            expect(await parseProjectFile(withPlan(cutPlan))).toEqual({
                ok: false,
                code: 'invalidContent',
                path,
            });
        }
    });

    test('custom com outra proporção é aceito e campos desconhecidos são ignorados', async () => {
        const result = await parseProjectFile(
            withPlan({
                proportion: 'golden',
                custom: { h: 2, w: 1.5, d: 1 },
                extra: 'ignorado',
            }),
        );

        expect(result).toEqual({
            ok: true,
            data: {
                ...FULL,
                cutPlan: {
                    proportion: 'golden',
                    custom: { h: 2, w: 1.5, d: 1 },
                },
            },
        });
    });

    test('versão 6 pede para atualizar o app', async () => {
        expect(
            await parseProjectFile(file(envelope(PLAN, { version: 6 }))),
        ).toEqual({ ok: false, code: 'newerVersion' });
    });
});

describe('bandpass de 6ª ordem e versão 4 (feature 007)', () => {
    const SIXTH: ProjectData = {
        ...FULL,
        name: 'Sub bandpass 6',
        box: {
            type: 'bandpass6',
            vb_m3: 0.06,
            vr_m3: 0.08,
            vf_m3: 0.04,
            ql: 7,
            fb_hz: 60,
            fb_rear_hz: 30,
            port: { shape: 'round', diameter_m: 0.075, count: 1 },
            port_rear: {
                shape: 'rect',
                width_m: 0.05,
                height_m: 0.2,
                count: 2,
            },
        },
        fieldUnits: {
            vr_m3: 'L',
            fb_rear_hz: 'Hz',
            rear_width_m: 'in',
        },
    };

    const versionOf = (text: string): number => JSON.parse(text).version;

    test('a versão gravada depende do tipo: 6ª ordem é 4, mesmo com plano de corte', () => {
        expect(versionOf(serializeProject(SIXTH))).toBe(4);
        expect(
            versionOf(
                serializeProject({
                    ...SIXTH,
                    cutPlan: { thickness_m: 0.025, proportion: 'louden' },
                }),
            ),
        ).toBe(4);
        expect(
            versionOf(
                serializeProject({
                    ...SIXTH,
                    box: { ...SIXTH.box, type: 'bandpass' },
                }),
            ),
        ).toBe(2);
        expect(versionOf(serializeProject(FULL))).toBe(1);
    });

    test('ida e volta reproduz câmaras, sintonias, os dois dutos e as unidades por campo', async () => {
        const result = await parseProjectFile(file(serializeProject(SIXTH)));

        expect(result).toEqual({ ok: true, data: SIXTH });
    });

    test('abre arquivos das versões 1, 2, 3 e 4', async () => {
        for (const [version, data] of [
            [1, FULL],
            [2, { ...FULL, box: { ...FULL.box, type: 'bandpass' } }],
            [
                3,
                {
                    ...FULL,
                    cutPlan: { thickness_m: 0.02, proportion: 'louden' },
                },
            ],
            [4, SIXTH],
        ] as const) {
            expect(
                await parseProjectFile(file(envelope(data, { version }))),
            ).toEqual({ ok: true, data });
        }
    });

    test('versão 6 é recusada pedindo para atualizar o app', async () => {
        expect(
            await parseProjectFile(file(envelope(SIXTH, { version: 6 }))),
        ).toEqual({ ok: false, code: 'newerVersion' });
    });

    test('Fbr fora de 5–500 Hz é recusada com o caminho', async () => {
        for (const fb_rear_hz of [4, 501]) {
            expect(
                await parseProjectFile(
                    file(
                        envelope(
                            { ...SIXTH, box: { ...SIXTH.box, fb_rear_hz } },
                            { version: 4 },
                        ),
                    ),
                ),
            ).toEqual({
                ok: false,
                code: 'invalidContent',
                path: 'project.box.fb_rear_hz',
            });
        }
    });

    test('duto traseiro fora da faixa é recusado com o caminho', async () => {
        const open = (port_rear: unknown) =>
            parseProjectFile(
                file(
                    envelope(
                        { ...SIXTH, box: { ...SIXTH.box, port_rear } },
                        { version: 4 },
                    ),
                ),
            );

        expect(await open({ shape: 'round', diameter_m: 5, count: 1 })).toEqual(
            {
                ok: false,
                code: 'invalidContent',
                path: 'project.box.port_rear.diameter_m',
            },
        );
        expect(
            await open({ shape: 'round', diameter_m: 0.1, count: 9 }),
        ).toEqual({
            ok: false,
            code: 'invalidContent',
            path: 'project.box.port_rear.count',
        });
        expect(await open({ shape: 'hexagon', count: 1 })).toMatchObject({
            ok: false,
            code: 'invalidContent',
        });
    });

    test('câmaras, sintonias e dutos ausentes abrem como projeto incompleto', async () => {
        const incomplete = {
            ...SIXTH,
            box: {
                type: 'bandpass6',
                ql: 7,
                port: { shape: 'round', count: 1 },
            },
            fieldUnits: {},
        };

        expect(
            await parseProjectFile(file(envelope(incomplete, { version: 4 }))),
        ).toEqual({ ok: true, data: incomplete });
    });

    test('unidade de outra grandeza em chave nova é descartada sem recusar o arquivo', async () => {
        const result = await parseProjectFile(
            file(
                envelope(
                    {
                        ...SIXTH,
                        fieldUnits: { rear_diameter_m: 'Hz', fb_rear_hz: 'Hz' },
                    },
                    { version: 4 },
                ),
            ),
        );

        expect(result).toMatchObject({
            ok: true,
            data: { fieldUnits: { fb_rear_hz: 'Hz' } },
        });
    });
});

describe('cor do projeto e versão 5 (feature 008)', () => {
    const versionOf = (text: string): number => JSON.parse(text).version;

    test('a versão atual é 5', () => {
        expect(CURRENT_VERSION).toBe(5);
    });

    test('com cor o arquivo é gravado como versão 5; sem cor, na menor versão', () => {
        expect(versionOf(serializeProject(FULL, new Date(), 4))).toBe(5);
        expect(versionOf(serializeProject(FULL))).toBe(1);
        expect(
            versionOf(
                serializeProject({
                    ...FULL,
                    box: { ...FULL.box, type: 'bandpass6' },
                }),
            ),
        ).toBe(4);
    });

    test('a cor vai na raiz do arquivo, fora do projeto', () => {
        const parsed = JSON.parse(serializeProject(FULL, new Date(), 4));

        expect(parsed.color).toBe(4);
        expect(parsed.project.color).toBeUndefined();
    });

    test('ida e volta devolve a cor', async () => {
        const result = await parseProjectFile(
            file(serializeProject(FULL, new Date(), 6)),
        );

        expect(result).toEqual({ ok: true, data: FULL, color: 6 });
    });

    test('arquivos das versões 1 a 4 abrem sem cor (SC-011)', async () => {
        for (const version of [1, 2, 3, 4]) {
            const result = await parseProjectFile(
                file(envelope(FULL, { version })),
            );

            expect(result).toEqual({ ok: true, data: FULL });
            expect(result.ok && result.color).toBeFalsy();
        }
    });

    test('cor fora de 1–6 ou não inteira recusa o arquivo com o caminho', async () => {
        for (const color of [0, 7, 2.5, '3', null]) {
            expect(
                await parseProjectFile(
                    file(envelope(FULL, { version: 5, color })),
                ),
            ).toEqual({ ok: false, code: 'invalidContent', path: 'color' });
        }
    });
});
