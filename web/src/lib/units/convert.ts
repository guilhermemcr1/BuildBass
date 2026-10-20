import { findUnit } from './quantities';
import type { UnitId } from './quantities';

export function toSi(value: number, unitId: UnitId): number {
    return value * findUnit(unitId).factor;
}

export function fromSi(si: number, unitId: UnitId): number {
    return si / findUnit(unitId).factor;
}
