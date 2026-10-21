import { Send } from 'lucide-react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ParameterField } from '@/components/ui/parameter-field';
import { deriveDriver } from '@/engine';
import type { DerivedDriver, DriverKey } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { DRIVER_PARAMETERS } from '@/lib/parameters';
import { CatalogSearch } from './catalog-search';
import { DriversFields } from './drivers-fields';
import { Panel } from './panel';
import { SignalFields } from './signal-fields';
import { useParameterField } from './use-parameter-field';

// Status de consistência do motor (research.md §4) e valor calculado de cada campo (FR-015–017).
function DriverField({
    parameter,
    derived,
}: {
    parameter: DriverKey;
    derived: DerivedDriver;
}) {
    const { t } = useTranslation('engine');
    const { locale } = useLocale();
    const field = useParameterField(parameter);
    const { status, relation, deviation } = derived.consistency[parameter];
    const percent = new Intl.NumberFormat(locale, {
        style: 'percent',
        maximumFractionDigits: 1,
    });

    return (
        <ParameterField
            {...field}
            status={status === 'derived' ? 'none' : status}
            statusMessage={
                relation !== undefined &&
                deviation !== undefined &&
                status !== 'ok'
                    ? t(`status.${relation}`, {
                          deviation: percent.format(deviation),
                      })
                    : undefined
            }
            derivedSi={
                status === 'derived'
                    ? derived.values[parameter].value
                    : undefined
            }
            derivedLabel={t('status.derived')}
        />
    );
}

type DriverPanelProps = {
    onSubmitDriver: () => void;
};

export function DriverPanel({ onSubmitDriver }: DriverPanelProps) {
    const { t } = useTranslation('workbench');
    const offline = useOnlineStatus() === 'offline';
    const driver = useActiveProject((state) => state.data.driver);
    const derived = deriveDriver(driver);
    const offlineReason = t('catalog.offlineReason');

    // Catálogo e envio dependem do servidor (constituição, Princípio V); o envio chega em feature
    // própria.
    const submit = (
        <Button
            variant="secondary"
            disabled={offline}
            onPress={onSubmitDriver}
            aria-description={offline ? offlineReason : undefined}
            className="shrink-0"
        >
            <Send aria-hidden="true" className="size-4" />
            {t('catalog.submit')}
        </Button>
    );

    return (
        <Panel region="driver" title={t('regions.driver')}>
            <div className="flex flex-wrap items-end gap-2">
                <CatalogSearch
                    disabled={offline}
                    disabledReason={offlineReason}
                    className="min-w-48 flex-1"
                />
                {submit}
            </div>
            <div className="grid grid-cols-2 items-start gap-2">
                {DRIVER_PARAMETERS.map((key) => (
                    <DriverField
                        key={key}
                        parameter={key as DriverKey}
                        derived={derived}
                    />
                ))}
            </div>
            <DriversFields />
            <SignalFields />
        </Panel>
    );
}
