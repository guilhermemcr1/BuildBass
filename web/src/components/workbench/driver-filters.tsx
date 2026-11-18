import { Group, Input, NumberField } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { FIELD_BOX, FIELD_INPUT } from '@/components/ui/field-box';
import { SelectField } from '@/components/ui/select-field';
import { DIAMETER_BANDS, filtersForBand } from '@/lib/catalog/diameter-bands';
import type { DiameterBandId } from '@/lib/catalog/diameter-bands';
import type { DriverFilters } from '@/lib/catalog/types';
import { DRIVER_TYPES } from '@/lib/project/types';
import type { DriverType } from '@/lib/project/types';
import { fromSi, toSi } from '@/lib/units/convert';
import { formatOptionsFor } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import type { QuantityId, UnitId, UnitSystem } from '@/lib/units/quantities';

// Faixa de um parâmetro em SI; cada ponta é opcional.
type Range = { min?: number; max?: number };

export type PickerFilters = {
    brand?: string;
    type?: DriverType;
    band?: DiameterBandId;
    fs: Range;
    qts: Range;
    vas: Range;
};

export const NO_PICKER_FILTERS: PickerFilters = {
    fs: {},
    qts: {},
    vas: {},
};

const ALL = 'all';

// Quantos filtros estão ligados (cada ponta de faixa conta um): vai no selo do botão.
export function countFilters(filters: PickerFilters): number {
    const ends = [filters.fs, filters.qts, filters.vas].flatMap((range) => [
        range.min,
        range.max,
    ]);

    return (
        (filters.brand === undefined ? 0 : 1) +
        (filters.type === undefined ? 0 : 1) +
        (filters.band === undefined ? 0 : 1) +
        ends.filter((value) => value !== undefined).length
    );
}

// Filtros da tela → parâmetros da API (tudo em SI).
export function toApiFilters(filters: PickerFilters): DriverFilters {
    const out: DriverFilters = {
        ...(filters.brand === undefined ? {} : { brand: filters.brand }),
        ...(filters.type === undefined ? {} : { type: filters.type }),
        ...filtersForBand(filters.band),
    };
    const pairs = [
        [filters.fs, 'fs_min_hz', 'fs_max_hz'],
        [filters.qts, 'qts_min', 'qts_max'],
        [filters.vas, 'vas_min_m3', 'vas_max_m3'],
    ] as const;

    for (const [range, minKey, maxKey] of pairs) {
        if (range.min !== undefined) {
            out[minKey] = range.min;
        }

        if (range.max !== undefined) {
            out[maxKey] = range.max;
        }
    }

    return out;
}

type DriverFiltersPanelProps = {
    value: PickerFilters;
    onChange: (value: PickerFilters) => void;
    unitSystem: UnitSystem;
    // Marcas do catálogo (GET /api/driver-brands); vazio enquanto carrega ou se falhar.
    brands: string[];
};

// Painel do botão "Filtros" do buscador: marca numa lista, tipo e diâmetro num clique, Fs, Qts e Vas por faixa
// (mínimo e máximo, na unidade da bancada).
export function DriverFiltersPanel({
    value,
    onChange,
    unitSystem,
    brands,
}: DriverFiltersPanelProps) {
    const { t } = useTranslation('workbench');
    const active = countFilters(value) > 0;
    const range = (key: 'fs' | 'qts' | 'vas', quantity: QuantityId) => ({
        value: value[key],
        unit: defaultUnitFor(quantity, unitSystem),
        onChange: (next: Range) => onChange({ ...value, [key]: next }),
    });

    return (
        <div
            role="group"
            aria-label={t('picker.filters')}
            className="space-y-3 border-b border-border bg-background/40 px-4 py-3"
        >
            <div className="grid gap-3 sm:grid-cols-3">
                {brands.length > 0 && (
                    <SelectField<string>
                        label={t('picker.brand')}
                        selected={value.brand ?? ALL}
                        onChange={(id) =>
                            onChange({
                                ...value,
                                brand: id === ALL ? undefined : id,
                            })
                        }
                        options={[
                            { id: ALL, label: t('picker.anyBrand') },
                            ...brands.map((brand) => ({
                                id: brand,
                                label: brand,
                            })),
                        ]}
                        className="min-w-0"
                    />
                )}
                <SelectField<string>
                    label={t('picker.type')}
                    selected={value.type ?? ALL}
                    onChange={(id) =>
                        onChange({
                            ...value,
                            type: id === ALL ? undefined : (id as DriverType),
                        })
                    }
                    options={[
                        { id: ALL, label: t('picker.any') },
                        ...DRIVER_TYPES.map((type) => ({
                            id: type,
                            label: t(`driverType.${type}`),
                        })),
                    ]}
                    className="min-w-0"
                />
                <SelectField<string>
                    label={t('picker.diameter')}
                    selected={value.band ?? ALL}
                    onChange={(id) =>
                        onChange({
                            ...value,
                            band:
                                id === ALL ? undefined : (id as DiameterBandId),
                        })
                    }
                    options={[
                        { id: ALL, label: t('picker.any') },
                        ...DIAMETER_BANDS.map((item) => ({
                            id: item.id,
                            label: item.label,
                        })),
                    ]}
                    className="min-w-0"
                />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                <RangeField label="Fs" {...range('fs', 'frequency')} />
                <RangeField label="Qts" {...range('qts', 'ratio')} />
                <RangeField label="Vas" {...range('vas', 'volume')} />
            </div>
            {active && (
                <div className="flex justify-end">
                    <Button
                        variant="quiet"
                        onPress={() => onChange(NO_PICKER_FILTERS)}
                        className="px-2 text-xs"
                    >
                        {t('picker.clearFilters')}
                    </Button>
                </div>
            )}
        </div>
    );
}

// Mínimo e máximo de um parâmetro, com a unidade no rótulo. Digita-se na unidade exibida; o
// estado fica em SI.
function RangeField({
    label,
    value,
    unit,
    onChange,
}: {
    label: string;
    value: Range;
    unit: UnitId;
    onChange: (next: Range) => void;
}) {
    const { t } = useTranslation('workbench');
    const symbol = findUnit(unit).symbol;
    const end = (key: 'min' | 'max') => (
        <NumberField
            aria-label={`${label} ${t(key === 'min' ? 'picker.min' : 'picker.max')}`}
            value={
                value[key] === undefined ? Number.NaN : fromSi(value[key], unit)
            }
            minValue={0}
            formatOptions={formatOptionsFor(unit)}
            onChange={(typed) =>
                onChange({
                    ...value,
                    [key]:
                        Number.isFinite(typed) && typed > 0
                            ? toSi(typed, unit)
                            : undefined,
                })
            }
            className="min-w-0 flex-1"
        >
            <Group className={FIELD_BOX}>
                <Input
                    placeholder={t(key === 'min' ? 'picker.min' : 'picker.max')}
                    className={FIELD_INPUT}
                />
            </Group>
        </NumberField>
    );

    return (
        <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs text-muted">
                {symbol === '' ? label : `${label} (${symbol})`}
            </span>
            <div className="flex items-center gap-1.5">
                {end('min')}
                <span aria-hidden="true" className="text-xs text-muted">
                    –
                </span>
                {end('max')}
            </div>
        </div>
    );
}
