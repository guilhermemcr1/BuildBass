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
import { DriverOrigin } from './driver-origin';
import { DriverPicker } from './driver-picker';
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

    // Catálogo e envio dependem do servidor (constituição, Princípio V).
    const actions = (
        <div className="flex items-center gap-1">
            <DriverPicker
                disabled={offline}
                disabledReason={offlineReason}
                onSubmitDriver={onSubmitDriver}
            />
            <Button
                variant="quiet"
                disabled={offline}
                onPress={onSubmitDriver}
                aria-label={t('catalog.submit')}
                aria-description={offline ? offlineReason : undefined}
                className="px-2.5"
            >
                <Send aria-hidden="true" className="size-4" />
            </Button>
        </div>
    );

    return (
        <Panel region="driver" title={t('regions.driver')} actions={actions}>
            <DriverOrigin />
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
