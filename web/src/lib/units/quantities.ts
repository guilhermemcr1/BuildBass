// Grandezas físicas, unidades aceitas e precisão de exibição (research.md §5).
// O valor guardado é sempre o SI; `factor` converte da unidade para o SI: si = valor × factor.

export type UnitSystem = 'metric' | 'imperial';

export type QuantityId =
    | 'frequency'
    | 'volume'
    | 'length'
    | 'area'
    | 'mass'
    | 'compliance'
    | 'inductance'
    | 'resistance'
    | 'power'
    | 'forceFactor'
    | 'mechResistance'
    | 'ratio'
    | 'efficiency'
    | 'level'
    | 'voltage'
    | 'time'
    | 'velocity'
    | 'count';

export type UnitId =
    | 'Hz'
    | 'm3'
    | 'L'
    | 'cm3'
    | 'ft3'
    | 'in3'
    | 'm'
    | 'cm'
    | 'mm'
    | 'in'
    | 'ft'
    | 'm2'
    | 'cm2'
    | 'in2'
    | 'kg'
    | 'g'
    | 'oz'
    | 'm/N'
    | 'mm/N'
    | 'H'
    | 'mH'
    | 'ohm'
    | 'W'
    | 'Tm'
    | 'kg/s'
    | 'none'
    | 'fraction'
    | 'percent'
    | 'dB'
    | 'V'
    | 's'
    | 'ms'
    | 'm/s'
    | 'ft/s'
    | 'count';

export type Unit = {
    id: UnitId;
    symbol: string;
    system: UnitSystem | 'both';
    factor: number;
    decimals: number;
};

export type Quantity = {
    id: QuantityId;
    siUnit: UnitId;
    units: Unit[];
    defaultUnit: Record<UnitSystem, UnitId>;
};

// Definições exatas: 1 in = 0,0254 m; 1 lb = 0,45359237 kg.
const INCH_M = 0.0254;
const FOOT_M = 12 * INCH_M;
const POUND_KG = 0.45359237;
const OUNCE_KG = POUND_KG / 16;

function unit(
    id: UnitId,
    symbol: string,
    system: Unit['system'],
    factor: number,
    decimals: number,
): Unit {
    return { id, symbol, system, factor, decimals };
}

function single(id: QuantityId, only: Unit): Quantity {
    return {
        id,
        siUnit: only.id,
        units: [only],
        defaultUnit: { metric: only.id, imperial: only.id },
    };
}

export const QUANTITIES: Record<QuantityId, Quantity> = {
    frequency: single('frequency', unit('Hz', 'Hz', 'both', 1, 1)),
    volume: {
        id: 'volume',
        siUnit: 'm3',
        units: [
            unit('L', 'L', 'metric', 1e-3, 1),
            unit('m3', 'm³', 'metric', 1, 4),
            unit('cm3', 'cm³', 'metric', 1e-6, 0),
            unit('ft3', 'ft³', 'imperial', FOOT_M ** 3, 2),
            unit('in3', 'in³', 'imperial', INCH_M ** 3, 0),
        ],
        defaultUnit: { metric: 'L', imperial: 'ft3' },
    },
    length: {
        id: 'length',
        siUnit: 'm',
        units: [
            unit('mm', 'mm', 'metric', 1e-3, 1),
            unit('cm', 'cm', 'metric', 1e-2, 2),
            unit('m', 'm', 'metric', 1, 4),
            unit('in', 'in', 'imperial', INCH_M, 3),
            unit('ft', 'ft', 'imperial', FOOT_M, 3),
        ],
        defaultUnit: { metric: 'mm', imperial: 'in' },
    },
    area: {
        id: 'area',
        siUnit: 'm2',
        units: [
            unit('cm2', 'cm²', 'metric', 1e-4, 0),
            unit('m2', 'm²', 'metric', 1, 4),
            unit('in2', 'in²', 'imperial', INCH_M ** 2, 1),
        ],
        defaultUnit: { metric: 'cm2', imperial: 'in2' },
    },
    mass: {
        id: 'mass',
        siUnit: 'kg',
        units: [
            unit('g', 'g', 'metric', 1e-3, 1),
            unit('kg', 'kg', 'metric', 1, 4),
            unit('oz', 'oz', 'imperial', OUNCE_KG, 2),
        ],
        defaultUnit: { metric: 'g', imperial: 'oz' },
    },
    compliance: {
        id: 'compliance',
        siUnit: 'm/N',
        units: [
            unit('mm/N', 'mm/N', 'both', 1e-3, 3),
            unit('m/N', 'm/N', 'both', 1, 6),
        ],
        defaultUnit: { metric: 'mm/N', imperial: 'mm/N' },
    },
    inductance: {
        id: 'inductance',
        siUnit: 'H',
        units: [
            unit('mH', 'mH', 'both', 1e-3, 2),
            unit('H', 'H', 'both', 1, 5),
        ],
        defaultUnit: { metric: 'mH', imperial: 'mH' },
    },
    resistance: single('resistance', unit('ohm', 'Ω', 'both', 1, 2)),
    power: single('power', unit('W', 'W', 'both', 1, 0)),
    forceFactor: single('forceFactor', unit('Tm', 'T·m', 'both', 1, 2)),
    mechResistance: single(
        'mechResistance',
        unit('kg/s', 'kg/s', 'both', 1, 2),
    ),
    ratio: single('ratio', unit('none', '', 'both', 1, 2)),
    efficiency: {
        id: 'efficiency',
        siUnit: 'fraction',
        units: [unit('percent', '%', 'both', 1e-2, 2)],
        defaultUnit: { metric: 'percent', imperial: 'percent' },
    },
    level: single('level', unit('dB', 'dB', 'both', 1, 1)),
    voltage: single('voltage', unit('V', 'V', 'both', 1, 2)),
    time: {
        id: 'time',
        siUnit: 's',
        units: [unit('ms', 'ms', 'both', 1e-3, 1)],
        defaultUnit: { metric: 'ms', imperial: 'ms' },
    },
    velocity: {
        id: 'velocity',
        siUnit: 'm/s',
        units: [
            unit('m/s', 'm/s', 'metric', 1, 1),
            unit('ft/s', 'ft/s', 'imperial', FOOT_M, 1),
        ],
        defaultUnit: { metric: 'm/s', imperial: 'ft/s' },
    },
    count: single('count', unit('count', '', 'both', 1, 0)),
};

const UNITS_BY_ID = new Map<UnitId, Unit>(
    Object.values(QUANTITIES).flatMap((quantity) =>
        quantity.units.map((item) => [item.id, item] as const),
    ),
);

export function findUnit(id: UnitId): Unit {
    const found = UNITS_BY_ID.get(id);

    if (found === undefined) {
        throw new Error(`Unidade desconhecida: ${id}`);
    }

    return found;
}

export function defaultUnitFor(
    quantity: QuantityId,
    system: UnitSystem,
): UnitId {
    return QUANTITIES[quantity].defaultUnit[system];
}
