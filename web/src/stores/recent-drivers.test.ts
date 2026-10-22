import { beforeEach, describe, expect, test } from 'vite-plus/test';
import {
    RECENT_DRIVERS_KEY,
    RECENT_DRIVERS_MAX,
    useRecentDrivers,
} from './recent-drivers';
import type { RecentDriver } from './recent-drivers';

function recent(n: number, extra: Partial<RecentDriver> = {}): RecentDriver {
    return {
        id: `id-${n}`,
        brand: 'Marca',
        model: `Modelo ${n}`,
        fs_hz: 30 + n,
        qts: 0.4,
        vas_m3: 0.05,
        ...extra,
    };
}

describe('drivers recentes', () => {
    beforeEach(() => {
        window.localStorage.clear();
        useRecentDrivers.setState({ items: [] });
    });

    test('guarda o mais novo primeiro', () => {
        useRecentDrivers.getState().add(recent(1));
        useRecentDrivers.getState().add(recent(2));

        expect(useRecentDrivers.getState().items.map((d) => d.id)).toEqual([
            'id-2',
            'id-1',
        ]);
    });

    test(`guarda no máximo ${RECENT_DRIVERS_MAX}`, () => {
        for (let n = 1; n <= RECENT_DRIVERS_MAX + 3; n++) {
            useRecentDrivers.getState().add(recent(n));
        }

        const ids = useRecentDrivers.getState().items.map((d) => d.id);
        expect(ids).toHaveLength(RECENT_DRIVERS_MAX);
        expect(ids[0]).toBe(`id-${RECENT_DRIVERS_MAX + 3}`);
    });

    test('o mesmo id sobe ao topo sem repetir', () => {
        useRecentDrivers.getState().add(recent(1));
        useRecentDrivers.getState().add(recent(2));
        useRecentDrivers.getState().add(recent(1, { fs_hz: 99 }));

        const items = useRecentDrivers.getState().items;
        expect(items.map((d) => d.id)).toEqual(['id-1', 'id-2']);
        expect(items[0].fs_hz).toBe(99);
    });

    test('grava só o resumo no localStorage', () => {
        useRecentDrivers.getState().add({
            ...recent(1, { variant: '4 Ω' }),
            // @ts-expect-error campo extra não deve ser gravado
            secret: 'x',
        });

        const saved = JSON.parse(
            window.localStorage.getItem(RECENT_DRIVERS_KEY) ?? '{}',
        );
        expect(saved.version).toBe(1);
        expect(saved.state.items[0]).toEqual({
            id: 'id-1',
            brand: 'Marca',
            model: 'Modelo 1',
            variant: '4 Ω',
            fs_hz: 31,
            qts: 0.4,
            vas_m3: 0.05,
        });
    });

    test('descarta item inválido ao reidratar', async () => {
        window.localStorage.setItem(
            RECENT_DRIVERS_KEY,
            JSON.stringify({
                version: 1,
                state: {
                    items: [
                        recent(1),
                        { id: 5, brand: 'x' },
                        null,
                        { ...recent(2), fs_hz: 'abc' },
                        recent(3),
                    ],
                },
            }),
        );

        await useRecentDrivers.persist.rehydrate();

        expect(useRecentDrivers.getState().items.map((d) => d.id)).toEqual([
            'id-1',
            'id-3',
        ]);
    });
    test('guarda tipo e diâmetro, e ao reidratar descarta tipo desconhecido e diâmetro inválido', async () => {
        useRecentDrivers
            .getState()
            .add(recent(1, { type: 'subwoofer', nominal_diameter_m: 0.3048 }));

        const saved = JSON.parse(
            window.localStorage.getItem(RECENT_DRIVERS_KEY) ?? '{}',
        );
        expect(saved.state.items[0]).toMatchObject({
            type: 'subwoofer',
            nominal_diameter_m: 0.3048,
        });

        window.localStorage.setItem(
            RECENT_DRIVERS_KEY,
            JSON.stringify({
                version: 1,
                state: {
                    items: [
                        {
                            ...recent(2),
                            type: 'tweeter',
                            nominal_diameter_m: 'x',
                        },
                        {
                            ...recent(3),
                            type: 'midbass',
                            nominal_diameter_m: 0.2,
                        },
                    ],
                },
            }),
        );
        await useRecentDrivers.persist.rehydrate();

        const [bad, good] = useRecentDrivers.getState().items;
        expect(bad).not.toHaveProperty('type');
        expect(bad).not.toHaveProperty('nominal_diameter_m');
        expect(good).toMatchObject({
            type: 'midbass',
            nominal_diameter_m: 0.2,
        });
    });
});
