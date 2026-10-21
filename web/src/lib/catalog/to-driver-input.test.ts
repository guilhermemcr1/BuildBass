import { describe, expect, test } from 'vite-plus/test';
import { toDriverInput } from './to-driver-input';
import type { CatalogDriver } from './types';

const DRIVER_ID = '0198a3c2-6d11-7c4e-9a52-3f1b8e0d7a10';

const DRIVER: CatalogDriver = {
    id: DRIVER_ID,
    brand: 'Triton',
    model: 'TR 620 12"',
    variant: '4 Ω',
    nominal_diameter_m: 0.3048,
    fs_hz: 76.94,
    qts: 0.717,
    qes: 0.779,
    vas_m3: 0.026348,
    sd_m2: 0.05309,
    source: 'ficha',
};

describe('toDriverInput', () => {
    test('só leva as chaves de driver presentes, com o valor exato', () => {
        const { driver } = toDriverInput(DRIVER);

        expect(driver).toEqual({
            fs_hz: 76.94,
            qts: 0.717,
            qes: 0.779,
            vas_m3: 0.026348,
            sd_m2: 0.05309,
        });
    });

    test('id, fonte, diâmetro e nomes não vazam para o driver', () => {
        const { driver } = toDriverInput(DRIVER);

        for (const key of [
            'id',
            'source',
            'nominal_diameter_m',
            'brand',
            'model',
            'variant',
        ]) {
            expect(driver).not.toHaveProperty(key);
        }
    });

    test('a origem leva fabricante, modelo e variação', () => {
        expect(toDriverInput(DRIVER).source).toEqual({
            brand: 'Triton',
            model: 'TR 620 12"',
            variant: '4 Ω',
        });
    });

    test('variante nula vira origem sem variante', () => {
        const { source } = toDriverInput({ ...DRIVER, variant: null });

        expect(source).toEqual({ brand: 'Triton', model: 'TR 620 12"' });
        expect(source).not.toHaveProperty('variant');
    });
});
