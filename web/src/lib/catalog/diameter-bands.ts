import type { DriverFilters } from './types';

const INCH_M = 0.0254;

// Faixas de diâmetro do filtro do buscador. Alto-falante se vende por polegada, então as faixas
// são centradas no tamanho comercial (10″ pega de 8,5″ a 11″, e assim por diante); o máximo de
// cada faixa é exclusivo, igual ao `diameter_max_m` da API.
export const DIAMETER_BANDS = [
    { id: 'd8', label: '≤ 8″', max_m: 8.5 * INCH_M },
    { id: 'd10', label: '10″', min_m: 8.5 * INCH_M, max_m: 11 * INCH_M },
    { id: 'd12', label: '12″', min_m: 11 * INCH_M, max_m: 13.5 * INCH_M },
    { id: 'd15', label: '15″', min_m: 13.5 * INCH_M, max_m: 16.5 * INCH_M },
    { id: 'd18', label: '≥ 18″', min_m: 16.5 * INCH_M },
] as const;

export type DiameterBandId = (typeof DIAMETER_BANDS)[number]['id'];

export function filtersForBand(
    id: DiameterBandId | undefined,
): Pick<DriverFilters, 'diameter_min_m' | 'diameter_max_m'> {
    const band = DIAMETER_BANDS.find((item) => item.id === id);

    if (band === undefined) {
        return {};
    }

    return {
        ...('min_m' in band ? { diameter_min_m: band.min_m } : {}),
        ...('max_m' in band ? { diameter_max_m: band.max_m } : {}),
    };
}
