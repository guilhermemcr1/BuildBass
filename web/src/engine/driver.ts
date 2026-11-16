import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import type {
    Consistency,
    DerivedDriver,
    DerivedValue,
    DriverInput,
    DriverKey,
    RelationId,
} from './types';

export const DRIVER_KEYS: DriverKey[] = [
    'fs_hz',
    'qts',
    'qes',
    'qms',
    'vas_m3',
    're_ohm',
    'le_h',
    'le10k_h',
    'xmax_m',
    'sd_m2',
    'pe_w',
    'bl_tm',
    'mms_kg',
    'vd_m3',
];

type Values = Partial<Record<DriverKey | 'cms_mn', number>>;

type Rule = {
    target: DriverKey | 'cms_mn';
    needs: (DriverKey | 'cms_mn')[];
    compute: (v: Required<Values>) => number;
};

const TWO_PI = 2 * Math.PI;
const RHO_C2 = AIR_DENSITY * SPEED_OF_SOUND ** 2;

// Relações de Thiele-Small de [S72] (Small, JAES 1972), aplicadas em ordem fixa até nada mudar
// (research.md §4):
//   Qts = Qes·Qms / (Qes + Qms)
//   Cms = Vas / (ρ·c²·Sd²)
//   Fs  = 1 / (2π·√(Mms·Cms))
//   Qes = 2π·Fs·Mms·Re / Bl²
const RULES: Rule[] = [
    {
        target: 'qts',
        needs: ['qes', 'qms'],
        compute: (v) => (v.qes * v.qms) / (v.qes + v.qms),
    },
    {
        target: 'qes',
        needs: ['qts', 'qms'],
        compute: (v) => (v.qts * v.qms) / (v.qms - v.qts),
    },
    {
        target: 'qms',
        needs: ['qts', 'qes'],
        compute: (v) => (v.qts * v.qes) / (v.qes - v.qts),
    },
    {
        target: 'cms_mn',
        needs: ['vas_m3', 'sd_m2'],
        compute: (v) => v.vas_m3 / (RHO_C2 * v.sd_m2 ** 2),
    },
    {
        target: 'cms_mn',
        needs: ['fs_hz', 'mms_kg'],
        compute: (v) => 1 / ((TWO_PI * v.fs_hz) ** 2 * v.mms_kg),
    },
    {
        target: 'mms_kg',
        needs: ['fs_hz', 'cms_mn'],
        compute: (v) => 1 / ((TWO_PI * v.fs_hz) ** 2 * v.cms_mn),
    },
    {
        target: 'fs_hz',
        needs: ['mms_kg', 'cms_mn'],
        compute: (v) => 1 / (TWO_PI * Math.sqrt(v.mms_kg * v.cms_mn)),
    },
    {
        target: 'vas_m3',
        needs: ['cms_mn', 'sd_m2'],
        compute: (v) => v.cms_mn * RHO_C2 * v.sd_m2 ** 2,
    },
    {
        target: 'bl_tm',
        needs: ['fs_hz', 'mms_kg', 're_ohm', 'qes'],
        compute: (v) =>
            Math.sqrt((TWO_PI * v.fs_hz * v.mms_kg * v.re_ohm) / v.qes),
    },
    {
        target: 'qes',
        needs: ['fs_hz', 'mms_kg', 're_ohm', 'bl_tm'],
        compute: (v) => (TWO_PI * v.fs_hz * v.mms_kg * v.re_ohm) / v.bl_tm ** 2,
    },
    {
        target: 'mms_kg',
        needs: ['fs_hz', 're_ohm', 'qes', 'bl_tm'],
        compute: (v) => (v.qes * v.bl_tm ** 2) / (TWO_PI * v.fs_hz * v.re_ohm),
    },
];

function usable(value: number | undefined): value is number {
    return value !== undefined && Number.isFinite(value) && value > 0;
}

function derive(input: DriverInput): Values {
    const values: Values = {};

    for (const key of DRIVER_KEYS) {
        if (
            usable(input[key]) ||
            ((key === 'le_h' || key === 'vd_m3' || key === 'xmax_m') &&
                input[key] === 0)
        ) {
            values[key] = input[key];
        }
    }

    let changed = true;

    while (changed) {
        changed = false;

        for (const rule of RULES) {
            if (values[rule.target] !== undefined) {
                continue;
            }

            if (!rule.needs.every((need) => values[need] !== undefined)) {
                continue;
            }

            const result = rule.compute(values as Required<Values>);

            if (usable(result)) {
                values[rule.target] = result;
                changed = true;
            }
        }
    }

    return values;
}

type Relation = {
    id: RelationId;
    terms: DriverKey[];
    // Valor do primeiro termo calculado pelos demais.
    expected: (v: Required<DriverInput>) => number;
};

// Conferência entre valores digitados (research.md §4, [S72]). Fs e Vas ligados por
// Cms = Vas/(ρ·c²·Sd²) e Fs = 1/(2π·√(Mms·Cms)) são uma só equação, citada como "fs".
const RELATIONS: Relation[] = [
    {
        id: 'qts',
        terms: ['qts', 'qes', 'qms'],
        expected: (v) => (v.qes * v.qms) / (v.qes + v.qms),
    },
    {
        id: 'fs',
        terms: ['fs_hz', 'mms_kg', 'vas_m3', 'sd_m2'],
        expected: (v) =>
            1 /
            (TWO_PI *
                Math.sqrt((v.mms_kg * v.vas_m3) / (RHO_C2 * v.sd_m2 ** 2))),
    },
    {
        id: 'qes',
        terms: ['qes', 'fs_hz', 'mms_kg', 're_ohm', 'bl_tm'],
        expected: (v) =>
            (TWO_PI * v.fs_hz * v.mms_kg * v.re_ohm) / v.bl_tm ** 2,
    },
];

// Limiares da divergência (spec FR-015): ≤ 3 % ok, ≤ 7 % atenção, acima disso erro.
const OK_LIMIT = 0.03;
const WARN_LIMIT = 0.07;
const SEVERITY = { ok: 0, warn: 1, error: 2 } as const;

function consistencyOf(
    input: DriverInput,
): Partial<Record<DriverKey, Consistency>> {
    const result: Partial<Record<DriverKey, Consistency>> = {};

    for (const relation of RELATIONS) {
        if (!relation.terms.every((term) => usable(input[term]))) {
            continue;
        }

        const [subject] = relation.terms;
        const expected = relation.expected(input as Required<DriverInput>);
        const deviation =
            Math.abs((input[subject] as number) - expected) / expected;
        const status =
            deviation <= OK_LIMIT
                ? 'ok'
                : deviation <= WARN_LIMIT
                  ? 'warn'
                  : 'error';

        for (const term of relation.terms) {
            const current = result[term];

            if (
                current === undefined ||
                SEVERITY[status] >
                    SEVERITY[current.status as keyof typeof SEVERITY]
            ) {
                result[term] = { status, relation: relation.id, deviation };
            }
        }
    }

    return result;
}

const RELATED = new Set(RELATIONS.flatMap((relation) => relation.terms));

export function deriveDriver(input: DriverInput): DerivedDriver {
    const values = derive(input);
    const result = {} as Record<DriverKey, DerivedValue>;
    const consistency = {} as Record<DriverKey, Consistency>;
    const checked = consistencyOf(input);

    for (const key of DRIVER_KEYS) {
        const typed = input[key] !== undefined;
        result[key] = {
            value: typed ? input[key] : values[key],
            source: typed ? 'typed' : 'derived',
        };
        consistency[key] = typed
            ? (checked[key] ?? {
                  status: RELATED.has(key) ? 'unchecked' : 'none',
              })
            : { status: values[key] === undefined ? 'none' : 'derived' };
    }

    return { values: result, cms_mn: values.cms_mn, consistency };
}
