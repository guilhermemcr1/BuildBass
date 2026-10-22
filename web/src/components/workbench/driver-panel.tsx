import { BookmarkPlus, Library, Send } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ParameterField } from '@/components/ui/parameter-field';
import { ShowMore } from '@/components/ui/show-more';
import { deriveDriver } from '@/engine';
import type { DerivedDriver, DriverKey } from '@/engine';
import {
    activeProjectStore,
    useActiveProject,
} from '@/hooks/use-active-project';
import { useOnlineStatus } from '@/hooks/use-online-status';
import {
    DRIVER_PARAMETERS,
    ESSENTIAL_DRIVER_PARAMETERS,
} from '@/lib/parameters';
import { readField } from '@/lib/project/fields';
import type { SavedDriverDraft } from '@/lib/saved-drivers/types';
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

const SaveDriverDialog = lazy(() => import('./save-driver-dialog'));
const SavedDriversDialog = lazy(() => import('./saved-drivers-dialog'));

// O que o diálogo de salvar mostra de partida: nome da origem (se houver), os parâmetros T/S do
// projeto e o recorte do plano, quando já informado.
function draftFromProject(): SavedDriverDraft {
    const { data } = activeProjectStore().getState();
    const cutout = readField(data, 'cutout_m');

    return {
        brand: data.driverSource?.brand ?? '',
        model: data.driverSource?.model ?? '',
        ...(data.driverSource?.variant === undefined
            ? {}
            : { variant: data.driverSource.variant }),
        driver: data.driver,
        ...(cutout === undefined ? {} : { cutout_m: cutout }),
    };
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
    const essential = ESSENTIAL_DRIVER_PARAMETERS;
    const advanced = DRIVER_PARAMETERS.filter(
        (key) => !essential.includes(key),
    );
    const advancedFilled = advanced.filter(
        (key) => driver[key as DriverKey] !== undefined,
    ).length;
    const [saving, setSaving] = useState<SavedDriverDraft | undefined>(
        undefined,
    );
    const [managing, setManaging] = useState(false);

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
            <Button
                variant="quiet"
                disabled={Object.keys(driver).length === 0}
                onPress={() => setSaving(draftFromProject())}
                aria-label={t('saved.saveButton')}
                className="px-2.5"
            >
                <BookmarkPlus aria-hidden="true" className="size-4" />
            </Button>
            <Button
                variant="quiet"
                onPress={() => setManaging(true)}
                aria-label={t('saved.manageButton')}
                className="px-2.5"
            >
                <Library aria-hidden="true" className="size-4" />
            </Button>
        </div>
    );

    return (
        <Panel region="driver" title={t('regions.driver')} actions={actions}>
            <DriverOrigin />
            <div className="grid grid-cols-2 items-start gap-2">
                {essential.map((key) => (
                    <DriverField
                        key={key}
                        parameter={key as DriverKey}
                        derived={derived}
                    />
                ))}
            </div>
            <ShowMore id="driverAdvanced" filled={advancedFilled}>
                <div className="grid grid-cols-2 items-start gap-2">
                    {advanced.map((key) => (
                        <DriverField
                            key={key}
                            parameter={key as DriverKey}
                            derived={derived}
                        />
                    ))}
                </div>
            </ShowMore>
            <DriversFields />
            <SignalFields />
            <Suspense fallback={null}>
                {saving !== undefined && (
                    <SaveDriverDialog
                        initial={saving}
                        onClose={() => setSaving(undefined)}
                    />
                )}
                {managing && (
                    <SavedDriversDialog onClose={() => setManaging(false)} />
                )}
            </Suspense>
        </Panel>
    );
}
