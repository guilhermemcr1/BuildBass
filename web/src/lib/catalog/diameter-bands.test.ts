import { describe, expect, test } from 'vite-plus/test';
import { DIAMETER_BANDS, filtersForBand } from './diameter-bands';

const INCH = 0.0254;

function bandOf(inches: number) {
    return DIAMETER_BANDS.find((band) => {
        const filters = filtersForBand(band.id);

        return (
            inches * INCH >= (filters.diameter_min_m ?? 0) &&
            inches * INCH < (filters.diameter_max_m ?? Infinity)
        );
    })?.id;
}

describe('filtersForBand', () => {
    test('os tamanhos comerciais caem na faixa do próprio número', () => {
        expect([6.5, 8, 10, 12, 15, 18, 21].map(bandOf)).toEqual([
            'd8',
            'd8',
            'd10',
            'd12',
            'd15',
            'd18',
            'd18',
        ]);
    });

    test('as faixas se emendam sem sobrepor e sem deixar buraco', () => {
        for (let index = 1; index < DIAMETER_BANDS.length; index += 1) {
            const previous = filtersForBand(DIAMETER_BANDS[index - 1].id);
            const current = filtersForBand(DIAMETER_BANDS[index].id);

            expect(previous.diameter_max_m).toBe(current.diameter_min_m);
        }
    });

    test('sem faixa não há filtro de diâmetro', () => {
        expect(filtersForBand(undefined)).toEqual({});
    });
});
