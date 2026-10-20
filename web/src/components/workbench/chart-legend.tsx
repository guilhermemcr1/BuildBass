import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type LegendItem = {
    id: string;
    label: string;
    slot: 1 | 2 | 3;
    emphasis: boolean;
    // Projeto plotado que ainda não tem dados para esta curva.
    empty: boolean;
};

const SWATCH: Record<LegendItem['slot'], string> = {
    1: 'bg-series-1',
    2: 'bg-series-2',
    3: 'bg-series-3',
};

export function ChartLegend({ items }: { items: LegendItem[] }) {
    const { t } = useTranslation(['workbench', 'engine']);

    if (items.length === 0) {
        return null;
    }

    return (
        <ul
            aria-label={t('workbench:charts.legend')}
            className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs"
        >
            {items.map((item) => (
                <li key={item.id} className="flex items-center gap-1.5">
                    <span
                        aria-hidden="true"
                        className={cn(
                            'h-0.5 w-4 rounded-full',
                            SWATCH[item.slot],
                            item.emphasis && 'h-1',
                        )}
                    />
                    <span className={cn(item.emphasis && 'font-semibold')}>
                        {item.label}
                    </span>
                    {item.empty && (
                        <span className="text-muted">
                            ({t('engine:charts.noData')})
                        </span>
                    )}
                </li>
            ))}
        </ul>
    );
}
