import { describe, expect, test } from 'vite-plus/test';
import { AIR_DENSITY, SPEED_OF_SOUND } from './constants';
import { deriveDriver } from './driver';

// Driver de referência coerente pelas relações de [S72] (quickstart.md).
const FS = 28;
const QES = 0.42;
const QMS = 4.1;
const VAS = 0.085;
const RE = 3.6;
const SD = 0.0491;
const CMS = VAS / (AIR_DENSITY * SPEED_OF_SOUND ** 2 * SD ** 2);
const MMS = 1 / ((2 * Math.PI * FS) ** 2 * CMS);
const BL = Math.sqrt((2 * Math.PI * FS * MMS * RE) / QES);
const QTS = (QES * QMS) / (QES + QMS);

function relative(actual: number | undefined, expected: number): number {
    return Math.abs((actual ?? Number.NaN) - expected) / expected;
}

describe('deriveDriver — derivação (R10)', () => {
    test('Qts, Qes e Qms se completam entre si', () => {
        expect(
            relative(
                deriveDriver({ qes: QES, qms: QMS }).values.qts.value,
                QTS,
            ),
        ).toBeLessThan(1e-9);
        expect(
            relative(
                deriveDriver({ qts: QTS, qms: QMS }).values.qes.value,
                QES,
            ),
        ).toBeLessThan(1e-9);
        expect(
            relative(
                deriveDriver({ qts: QTS, qes: QES }).values.qms.value,
                QMS,
            ),
        ).toBeLessThan(1e-9);
    });

    test('Mms de Fs, Vas e Sd; Vas de Fs, Mms e Sd', () => {
        expect(
            relative(
                deriveDriver({ fs_hz: FS, vas_m3: VAS, sd_m2: SD }).values
                    .mms_kg.value,
                MMS,
            ),
        ).toBeLessThan(1e-9);
        expect(
            relative(
                deriveDriver({ fs_hz: FS, mms_kg: MMS, sd_m2: SD }).values
                    .vas_m3.value,
                VAS,
            ),
        ).toBeLessThan(1e-9);
    });

    test('Bl de Fs, Mms, Re e Qes, e Fs de Mms e Vas', () => {
        expect(
            relative(
                deriveDriver({ fs_hz: FS, mms_kg: MMS, re_ohm: RE, qes: QES })
                    .values.bl_tm.value,
                BL,
            ),
        ).toBeLessThan(1e-9);
        expect(
            relative(
                deriveDriver({ mms_kg: MMS, vas_m3: VAS, sd_m2: SD }).values
                    .fs_hz.value,
                FS,
            ),
        ).toBeLessThan(1e-9);
    });

    test('valor digitado nunca é sobrescrito e a origem é informada', () => {
        const derived = deriveDriver({ qts: 0.5, qes: QES, qms: QMS });

        expect(derived.values.qts).toEqual({ value: 0.5, source: 'typed' });
        expect(deriveDriver({ qes: QES, qms: QMS }).values.qts.source).toBe(
            'derived',
        );
        expect(derived.values.bl_tm).toEqual({
            value: undefined,
            source: 'derived',
        });
    });

    test('Cms derivado de Vas e Sd', () => {
        expect(
            relative(deriveDriver({ vas_m3: VAS, sd_m2: SD }).cms_mn, CMS),
        ).toBeLessThan(1e-9);
    });
});
