import { describe, expect, test } from 'vite-plus/test';
import { fromSi, toSi } from './convert';
import { QUANTITIES } from './quantities';

describe('conversão de unidades', () => {
    test('85 L equivale a 3,00 ft³', () => {
        const si = toSi(85, 'L');

        expect(si).toBeCloseTo(0.085, 12);
        expect(fromSi(si, 'ft3')).toBeCloseTo(3.001747, 6);
    });

    test('1 in = 25,4 mm e 1 oz = 28,349523125 g', () => {
        expect(fromSi(toSi(1, 'in'), 'mm')).toBeCloseTo(25.4, 12);
        expect(fromSi(toSi(1, 'oz'), 'g')).toBeCloseTo(28.349523125, 9);
    });

    test('ida e volta em todas as unidades devolve o valor original', () => {
        for (const quantity of Object.values(QUANTITIES)) {
            for (const unit of quantity.units) {
                expect(fromSi(toSi(123.456, unit.id), unit.id)).toBeCloseTo(
                    123.456,
                    9,
                );
            }
        }
    });

    test('20 idas e voltas L → ft³ → L não acumulam desvio (SC-004)', () => {
        let litres = 85;

        for (let round = 0; round < 20; round++) {
            const cubicFeet = fromSi(toSi(litres, 'L'), 'ft3');
            litres = fromSi(toSi(cubicFeet, 'ft3'), 'L');
        }

        expect(Math.abs(litres - 85) / 85).toBeLessThan(1e-12);
    });
});
