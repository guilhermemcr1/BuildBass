import { Suspense, lazy, useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Tabs } from '@/components/ui/tabs';
import { PARAMETERS } from '@/lib/parameters';
import type { DriverKey } from '@/lib/project/types';
import { useActiveProject } from '@/hooks/use-active-project';
import { Panel } from './panel';

const ChartFrame = lazy(() => import('./chart-frame'));

export type ChartKind =
    | 'response'
    | 'excursion'
    | 'impedance'
    | 'groupDelay'
    | 'portVelocity';

export const CHART_KINDS: ChartKind[] = [
    'response',
    'excursion',
    'impedance',
    'groupDelay',
    'portVelocity',
];

// Mínimo para desenhar a resposta de qualquer caixa (Small, 1972/1973).
const REQUIRED: DriverKey[] = ['fs_hz', 'qts', 'vas_m3'];

type ChartPanelProps = {
    selected?: ChartKind;
    onSelectedChange?: (kind: ChartKind) => void;
};

export function ChartPanel({ selected, onSelectedChange }: ChartPanelProps) {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const values = useActiveProject((state) => state.data.driver);
    const [localSelected, setLocalSelected] = useState<ChartKind>('response');
    const current = selected ?? localSelected;
    const missing = REQUIRED.filter((key) => values[key] === undefined);
    const list = new Intl.ListFormat(locale, {
        style: 'long',
        type: 'conjunction',
    }).format(missing.map((key) => PARAMETERS[key].symbol));

    return (
        <Panel region="charts" title={t('regions.charts')} className="min-h-96">
            <Tabs<ChartKind>
                label={t('charts.label')}
                items={CHART_KINDS.map((id) => ({
                    id,
                    label: t(`charts.${id}`),
                }))}
                selected={current}
                onChange={(kind) => {
                    setLocalSelected(kind);
                    onSelectedChange?.(kind);
                }}
                className="flex-1"
            >
                {() => (
                    <div className="relative h-80 pt-3 xl:h-full xl:min-h-72">
                        <Suspense>
                            <ChartFrame
                                xLabel={t('charts.frequency')}
                                yLabel={t('charts.level')}
                            />
                        </Suspense>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                            <div className="max-w-xs rounded-lg border border-border bg-surface/90 px-4 py-3 text-center">
                                {missing.length > 0 ? (
                                    <>
                                        <p className="text-sm font-semibold">
                                            {t('charts.emptyTitle')}
                                        </p>
                                        <p className="mt-1 text-sm text-muted">
                                            {t('charts.emptyBody', {
                                                missing: list,
                                            })}
                                        </p>
                                    </>
                                ) : (
                                    <p className="text-sm text-muted">
                                        {t('charts.emptyReady')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Tabs>
        </Panel>
    );
}
