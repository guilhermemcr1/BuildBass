import { BookmarkPlus, Ellipsis, Library, Send } from 'lucide-react';
import { Suspense, lazy, useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Menu } from '@/components/ui/menu';
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
import { DriverDimensions } from './driver-dimensions';
import { DriverIdentity } from './driver-identity';
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

type DriverAction = 'save' | 'mine' | 'submit';

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
        ...(data.driverSource?.type === undefined
            ? {}
            : { type: data.driverSource.type }),
        driver: data.driver,
        ...(cutout === undefined ? {} : { cutout_m: cutout }),
        ...(data.driverDims?.a_m === undefined
            ? {}
            : { nominal_diameter_m: data.driverDims.a_m }),
        ...(data.driverDims?.g_m === undefined
            ? {}
            : { depth_m: data.driverDims.g_m }),
    };
}

type DriverPanelProps = {
    onSubmitDriver: () => void;
};

export function DriverPanel({ onSubmitDriver }: DriverPanelProps) {
    const { t } = useTranslation('workbench');
    const { t: tCommon } = useTranslation('common');
    const offline = useOnlineStatus() === 'offline';
    const driver = useActiveProject((state) => state.data.driver);
    const derived = deriveDriver(driver);
    const offlineReason = t('catalog.offlineReason');
    const essential = ESSENTIAL_DRIVER_PARAMETERS;
    // O volume do motor (M-Vd) mora na seção de dimensões.
    const advanced = DRIVER_PARAMETERS.filter(
        (key) => !essential.includes(key) && key !== 'vd_m3',
    );
    const advancedFilled = advanced.filter(
        (key) => driver[key as DriverKey] !== undefined,
    ).length;
    const [saving, setSaving] = useState<SavedDriverDraft | undefined>(
        undefined,
    );
    const [managing, setManaging] = useState(false);

    // Uma ação à vista (buscar) e as demais num menu: enviar ao catálogo (depende do servidor,
    // Princípio V), salvar e abrir a lista pessoal.
    const actions = (
        <div className="flex min-w-0 items-center gap-1">
            <DriverPicker
                disabled={offline}
                disabledReason={offlineReason}
                onSubmitDriver={onSubmitDriver}
            />
            <Menu<DriverAction>
                label={t('driverMenu')}
                triggerLabel={t('driverMenu')}
                trigger={
                    <span className="flex size-[34px] items-center justify-center rounded-md text-foreground data-[hovered]:bg-raised">
                        <Ellipsis aria-hidden="true" className="size-4" />
                    </span>
                }
                triggerClassName="rounded-md hover:bg-raised"
                items={[
                    {
                        id: 'save',
                        label: t('saved.saveButton'),
                        icon: (
                            <BookmarkPlus
                                aria-hidden="true"
                                className="size-4"
                            />
                        ),
                        disabled: Object.keys(driver).length === 0,
                    },
                    {
                        id: 'mine',
                        label: t('saved.manageButton'),
                        icon: <Library aria-hidden="true" className="size-4" />,
                    },
                    {
                        id: 'submit',
                        label: t('catalog.submit'),
                        icon: <Send aria-hidden="true" className="size-4" />,
                        disabled: offline,
                    },
                ]}
                onAction={(action) => {
                    if (action === 'save') {
                        setSaving(draftFromProject());
                    } else if (action === 'mine') {
                        setManaging(true);
                    } else {
                        onSubmitDriver();
                    }
                }}
            />
        </div>
    );

    return (
        <Panel
            region="driver"
            title={t('regions.driver')}
            actions={actions}
            flush
        >
            <DriverIdentity />
            <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2">
                {essential.map((key) => (
                    <DriverField
                        key={key}
                        parameter={key as DriverKey}
                        derived={derived}
                    />
                ))}
            </div>
            <p className="text-xs text-muted">{tCommon('required.legend')}</p>
            <ShowMore id="driverAdvanced" filled={advancedFilled}>
                <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2">
                    {advanced.map((key) => (
                        <DriverField
                            key={key}
                            parameter={key as DriverKey}
                            derived={derived}
                        />
                    ))}
                </div>
            </ShowMore>
            <DriverDimensions />
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
