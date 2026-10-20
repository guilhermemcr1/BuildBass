import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import type {
    Consistency,
    DerivedDriver,
    DerivedValue,
    DriverInput,
    DriverKey,
} from './types';

export const DRIVER_KEYS: DriverKey[] = [
    'fs_hz',
    'qts',
    'qes',
    'qms',
    'vas_m3',
    're_ohm',
    'le_h',
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

export function deriveDriver(input: DriverInput): DerivedDriver {
    const values = derive(input);
    const result = {} as Record<DriverKey, DerivedValue>;
    const consistency = {} as Record<DriverKey, Consistency>;

    for (const key of DRIVER_KEYS) {
        const typed = input[key] !== undefined;
        result[key] = {
            value: typed ? input[key] : values[key],
            source: typed ? 'typed' : 'derived',
        };
        consistency[key] = { status: 'none' };
    }

    return { values: result, cms_mn: values.cms_mn, consistency };
}
