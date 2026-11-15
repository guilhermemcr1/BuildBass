import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ParameterField } from '@/components/ui/parameter-field';
import { MAX_STOCK_ITEMS, stockItems } from '@/cutplan';
import type { StockItem } from '@/cutplan';
import { useActiveProject } from '@/hooks/use-active-project';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { setStock } from '@/lib/project/fields';
import { defaultUnitFor } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

type Field = 'w_m' | 'h_m' | 'quantity';

const PARAMETER: Record<Field, ParameterKey> = {
    w_m: 'sheet_w_m',
    h_m: 'sheet_h_m',
    quantity: 'sheet_quantity',
};

// Lê e grava o estoque (specs/012). Sem chapa, a lista mostra um item vazio para digitar, como a
// chapa única da 008. Cada mudança grava a lista inteira: uma etapa do Desfazer.
function useStock() {
    const sheet = useActiveProject((state) => state.data.cutPlan?.sheet);
    const apply = useActiveProject((state) => state.apply);
    const fieldUnits = useActiveProject((state) => state.data.fieldUnits);
    const setFieldUnit = useActiveProject((state) => state.setFieldUnit);
    const unitSystem = usePreferences((state) => state.unitSystem);
    const stored = stockItems(sheet);
    const items: StockItem[] = stored.length === 0 ? [{}] : stored;
    const write = (next: StockItem[]) => apply((data) => setStock(data, next));

    const field = (index: number, key: Field, labelContext?: string) => {
        const parameter = PARAMETER[key];

        return {
            parameter,
            valueSi: items[index][key],
            unit:
                fieldUnits[parameter] ??
                defaultUnitFor(PARAMETERS[parameter].quantity, unitSystem),
            onUnitChange: (unit: UnitId) => setFieldUnit(parameter, unit),
            onChangeSi: (si: number | undefined) =>
                write(
                    items.map((item, at) => {
                        if (at !== index) {
                            return item;
                        }

                        const next = { ...item };

                        if (si === undefined) {
                            delete next[key];
                        } else {
                            next[key] =
                                key === 'quantity' ? Math.round(si) : si;
                        }

                        return next;
                    }),
                ),
            labelContext,
            layout: 'row' as const,
        };
    };

    return { items, write, field };
}

// Medidas de cada chapa do estoque, com subir, descer e remover quando há mais de uma.
export function StockList() {
    const { t } = useTranslation('cutplan');
    const { items, write, field } = useStock();
    const limitId = useId();
    const many = items.length > 1;
    const full = items.length >= MAX_STOCK_ITEMS;
    const label = (index: number) => t('stock.item', { n: index + 1 });
    const move = (from: number, to: number) => {
        const next = [...items];
        [next[from], next[to]] = [next[to], next[from]];
        write(next);
    };

    return (
        <div className="flex flex-col gap-2.5">
            <ul aria-label={t('stock.label')} className="flex flex-col gap-2.5">
                {items.map((_, index) => (
                    <li
                        key={index}
                        className={
                            many
                                ? 'flex flex-col gap-2 rounded-md border border-border p-2'
                                : 'flex flex-col gap-2.5'
                        }
                        data-stock-item={index + 1}
                    >
                        {many && (
                            <div className="flex min-w-0 items-center gap-1">
                                <span className="flex-1 text-xs font-semibold text-muted">
                                    {label(index)}
                                </span>
                                <Button
                                    variant="quiet"
                                    className="h-7 px-1.5"
                                    aria-label={t('stock.moveUp', {
                                        n: index + 1,
                                    })}
                                    disabled={index === 0}
                                    onPress={() => move(index, index - 1)}
                                >
                                    <ArrowUp
                                        aria-hidden="true"
                                        className="size-3.5"
                                    />
                                </Button>
                                <Button
                                    variant="quiet"
                                    className="h-7 px-1.5"
                                    aria-label={t('stock.moveDown', {
                                        n: index + 1,
                                    })}
                                    disabled={index === items.length - 1}
                                    onPress={() => move(index, index + 1)}
                                >
                                    <ArrowDown
                                        aria-hidden="true"
                                        className="size-3.5"
                                    />
                                </Button>
                                <Button
                                    variant="quiet"
                                    className="h-7 px-1.5"
                                    aria-label={t('stock.remove', {
                                        n: index + 1,
                                    })}
                                    onPress={() =>
                                        write(
                                            items.filter(
                                                (__, at) => at !== index,
                                            ),
                                        )
                                    }
                                >
                                    <X
                                        aria-hidden="true"
                                        className="size-3.5"
                                    />
                                </Button>
                            </div>
                        )}
                        <ParameterField
                            {...field(
                                index,
                                'w_m',
                                many ? label(index) : undefined,
                            )}
                        />
                        <ParameterField
                            {...field(
                                index,
                                'h_m',
                                many ? label(index) : undefined,
                            )}
                        />
                    </li>
                ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="secondary"
                    disabled={full}
                    aria-describedby={full ? limitId : undefined}
                    onPress={() => write([...items, {}])}
                >
                    <Plus aria-hidden="true" className="size-4" />
                    {t('stock.add')}
                </Button>
                {full && (
                    <p id={limitId} className="text-xs text-muted">
                        {t('stock.limit', { max: MAX_STOCK_ITEMS })}
                    </p>
                )}
            </div>
        </div>
    );
}

// Quantidade de cada item (vazio = sem limite): fica entre os avançados do plano (FR-024).
export function StockQuantities() {
    const { t } = useTranslation('cutplan');
    const { items, field } = useStock();

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-semibold text-muted">
                {t('stock.quantities')}
            </legend>
            {items.map((item, index) => (
                <ParameterField
                    key={index}
                    {...field(
                        index,
                        'quantity',
                        t('stock.item', { n: index + 1 }),
                    )}
                    calculatedLabel={
                        item.quantity === undefined
                            ? t('stock.unlimited')
                            : undefined
                    }
                />
            ))}
        </fieldset>
    );
}
