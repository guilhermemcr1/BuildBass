import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import {
    sanitizeDraft,
    sanitizeSavedDriver,
} from '@/lib/saved-drivers/sanitize';
import { SAVED_DRIVERS_MAX, identityOf } from '@/lib/saved-drivers/types';
import type { SavedDriverDraft } from '@/lib/saved-drivers/types';
import { SAVED_DRIVERS_KEY, useSavedDrivers } from './saved-drivers';

function draft(
    model: string,
    extra: Partial<SavedDriverDraft> = {},
): SavedDriverDraft {
    return {
        brand: 'Marca',
        model,
        driver: { fs_hz: 32, qts: 0.42, vas_m3: 0.09 },
        ...extra,
    };
}

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('alto-falantes salvos — store', () => {
    beforeEach(() => {
        window.localStorage.clear();
        useSavedDrivers.setState({ items: [] });
    });

    test('salvar gera id UUID v4 e savedAt ISO, com o mais novo primeiro', () => {
        const first = useSavedDrivers.getState().save(draft('A'));
        const second = useSavedDrivers.getState().save(draft('B'));

        expect(first.status).toBe('saved');
        expect(second.status).toBe('saved');
        const items = useSavedDrivers.getState().items;
        expect(items.map((item) => item.model)).toEqual(['B', 'A']);
        expect(items[0].id).toMatch(UUID);
        expect(Number.isNaN(Date.parse(items[0].savedAt))).toBe(false);
    });

    test('unicidade por marca + modelo + variante, sem diferenciar maiúsculas', () => {
        useSavedDrivers.getState().save(draft('TR 620', { variant: '4 Ω' }));

        const same = useSavedDrivers
            .getState()
            .save({ ...draft('tr 620', { variant: '4 ω' }), brand: 'MARCA' });
        const other = useSavedDrivers
            .getState()
            .save(draft('TR 620', { variant: '8 Ω' }));

        expect(same.status).toBe('duplicate');
        expect(other.status).toBe('saved');
        expect(useSavedDrivers.getState().items).toHaveLength(2);
        expect(identityOf(draft('X'))).toBe(identityOf(draft(' x ')));
    });

    test(`limite de ${SAVED_DRIVERS_MAX} itens`, () => {
        for (let n = 0; n < SAVED_DRIVERS_MAX; n++) {
            useSavedDrivers.getState().save(draft(`M${n}`));
        }

        expect(useSavedDrivers.getState().save(draft('extra')).status).toBe(
            'full',
        );
        expect(useSavedDrivers.getState().items).toHaveLength(
            SAVED_DRIVERS_MAX,
        );
    });

    test('substituir mantém o id e troca os dados', () => {
        const saved = useSavedDrivers.getState().save(draft('A'));
        const id = saved.status === 'saved' ? saved.driver.id : '';

        useSavedDrivers
            .getState()
            .replace(id, draft('A', { driver: { fs_hz: 40 }, cutout_m: 0.3 }));

        const [item] = useSavedDrivers.getState().items;
        expect(item.id).toBe(id);
        expect(item.driver).toEqual({ fs_hz: 40 });
        expect(item.cutout_m).toBe(0.3);
    });

    test('excluir tira só o item', () => {
        useSavedDrivers.getState().save(draft('A'));
        const second = useSavedDrivers.getState().save(draft('B'));
        const id = second.status === 'saved' ? second.driver.id : '';

        useSavedDrivers.getState().remove(id);

        expect(useSavedDrivers.getState().items.map((i) => i.model)).toEqual([
            'A',
        ]);
    });

    test('importar: novos entram, duplicatas são substituídas ou mantidas', () => {
        useSavedDrivers.getState().save(draft('A', { driver: { fs_hz: 20 } }));

        const kept = useSavedDrivers
            .getState()
            .importMany(
                [draft('A', { driver: { fs_hz: 99 } }), draft('B')],
                'keep',
            );
        expect(kept).toEqual({
            status: 'ok',
            added: 1,
            replaced: 0,
            ignored: 1,
        });
        expect(
            useSavedDrivers.getState().items.find((i) => i.model === 'A')
                ?.driver,
        ).toEqual({ fs_hz: 20 });

        const replaced = useSavedDrivers
            .getState()
            .importMany([draft('A', { driver: { fs_hz: 99 } })], 'replace');
        expect(replaced).toEqual({
            status: 'ok',
            added: 0,
            replaced: 1,
            ignored: 0,
        });
        expect(
            useSavedDrivers.getState().items.find((i) => i.model === 'A')
                ?.driver,
        ).toEqual({ fs_hz: 99 });
    });

    test('importar que passaria do limite é recusado com o total', () => {
        for (let n = 0; n < SAVED_DRIVERS_MAX - 1; n++) {
            useSavedDrivers.getState().save(draft(`M${n}`));
        }

        const result = useSavedDrivers
            .getState()
            .importMany([draft('novo1'), draft('novo2')], 'keep');

        expect(result).toEqual({
            status: 'tooMany',
            total: SAVED_DRIVERS_MAX + 1,
        });
        expect(useSavedDrivers.getState().items).toHaveLength(
            SAVED_DRIVERS_MAX - 1,
        );
    });

    test('grava no localStorage e descarta item inválido ao reidratar', async () => {
        useSavedDrivers.getState().save(draft('A'));
        const saved = JSON.parse(
            window.localStorage.getItem(SAVED_DRIVERS_KEY) ?? '{}',
        );
        expect(saved.version).toBe(1);

        window.localStorage.setItem(
            SAVED_DRIVERS_KEY,
            JSON.stringify({
                version: 1,
                state: {
                    items: [
                        ...saved.state.items,
                        { ...saved.state.items[0], id: 'x', brand: '' },
                        {
                            ...saved.state.items[0],
                            id: 'y',
                            driver: { fs_hz: -1 },
                        },
                        null,
                        'texto',
                    ],
                },
            }),
        );
        await useSavedDrivers.persist.rehydrate();

        expect(useSavedDrivers.getState().items.map((i) => i.model)).toEqual([
            'A',
        ]);
    });

    test('o módulo não importa Zod (carregado só ao importar arquivo)', () => {
        for (const file of [
            'src/stores/saved-drivers.ts',
            'src/lib/saved-drivers/sanitize.ts',
            'src/lib/saved-drivers/types.ts',
        ]) {
            expect(readFileSync(file, 'utf8')).not.toMatch(
                /from 'zod'|import\('zod'\)/,
            );
        }
    });
});

describe('sanitizeDraft / sanitizeSavedDriver', () => {
    const base = {
        id: 'abc',
        savedAt: '2026-10-21T12:00:00.000Z',
        ...draft('A'),
    };

    test('aceita um item bem formado e apara os textos', () => {
        expect(
            sanitizeDraft({
                ...draft('  A  '),
                brand: ' Marca ',
                variant: ' 4 Ω ',
            }),
        ).toEqual({ ...draft('A'), variant: '4 Ω' });
        expect(sanitizeSavedDriver(base)).toEqual(base);
    });

    test('marca e modelo de 1 a 80 caracteres, variante de 1 a 40', () => {
        expect(sanitizeDraft({ ...draft('A'), brand: '' })).toBeUndefined();
        expect(
            sanitizeDraft({ ...draft('A'), brand: 'x'.repeat(81) }),
        ).toBeUndefined();
        expect(sanitizeDraft(draft('x'.repeat(80)))).toBeDefined();
        expect(sanitizeDraft(draft('x'.repeat(81)))).toBeUndefined();
        expect(sanitizeDraft(draft('A', { variant: '' }))).toBeUndefined();
        expect(
            sanitizeDraft(draft('A', { variant: 'x'.repeat(41) })),
        ).toBeUndefined();
        expect(
            sanitizeDraft(draft('A', { variant: 'x'.repeat(40) })),
        ).toBeDefined();
    });

    test('parâmetro fora da faixa de PARAMETERS invalida o item; chave desconhecida é ignorada', () => {
        expect(
            sanitizeDraft(draft('A', { driver: { qts: 11 } })),
        ).toBeUndefined();
        expect(
            sanitizeDraft(draft('A', { driver: { fs_hz: 0.5 } })),
        ).toBeUndefined();
        expect(
            sanitizeDraft({ ...draft('A'), driver: { fs_hz: 30, foo: 5 } }),
        ).toEqual(draft('A', { driver: { fs_hz: 30 } }));
        expect(
            sanitizeDraft({ ...draft('A'), driver: { fs_hz: '30' } }),
        ).toBeUndefined();
    });

    test('diâmetro nominal 0,03–1,5 m, recorte 0,03–1 m e profundidade 0,02–1 m', () => {
        expect(
            sanitizeDraft(draft('A', { nominal_diameter_m: 0.03 })),
        ).toBeDefined();
        expect(
            sanitizeDraft(draft('A', { nominal_diameter_m: 1.5 })),
        ).toBeDefined();
        expect(
            sanitizeDraft(draft('A', { nominal_diameter_m: 1.6 })),
        ).toBeUndefined();
        expect(sanitizeDraft(draft('A', { cutout_m: 0.02 }))).toBeUndefined();
        expect(sanitizeDraft(draft('A', { cutout_m: 1 }))).toBeDefined();
        expect(sanitizeDraft(draft('A', { cutout_m: 1.1 }))).toBeUndefined();
        expect(sanitizeDraft(draft('A', { depth_m: 0.02 }))).toBeDefined();
        expect(sanitizeDraft(draft('A', { depth_m: 0.01 }))).toBeUndefined();
    });

    test('o item salvo exige id e savedAt válidos', () => {
        expect(sanitizeSavedDriver({ ...base, id: '' })).toBeUndefined();
        expect(
            sanitizeSavedDriver({ ...base, savedAt: 'ontem' }),
        ).toBeUndefined();
        expect(sanitizeSavedDriver(null)).toBeUndefined();
    });
});
