import { fromSi } from './convert';
import { findUnit } from './quantities';
import type { UnitId } from './quantities';

export const EMPTY_VALUE = '—';

export function formatOptionsFor(unitId: UnitId): Intl.NumberFormatOptions {
    const { decimals } = findUnit(unitId);

    return {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
        notation: 'standard',
    };
}

export function formatQuantity(
    si: number | undefined,
    unitId: UnitId,
    locale: string,
): string {
    if (si === undefined || !Number.isFinite(si)) {
        return EMPTY_VALUE;
    }

    return new Intl.NumberFormat(locale, formatOptionsFor(unitId)).format(
        fromSi(si, unitId),
    );
}
