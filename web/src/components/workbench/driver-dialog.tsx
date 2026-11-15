import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/dialog';
import { deriveDriver } from '@/engine';
import type { DriverKey } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { DRIVER_PARAMETERS } from '@/lib/parameters';
import { DriverDimensions } from './driver-dimensions';
import { DriverField } from './driver-field';
import { DriverIdentity } from './driver-identity';
import { DriversFields } from './drivers-fields';
import { SignalFields } from './signal-fields';

type DriverDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

// Modal do driver: identificação e todos os parâmetros T/S à esquerda e, à direita, as medidas
// físicas, a quantidade/ligação e o sinal, sem nada recolhido. Mexer num campo atualiza o projeto
// ativo (é o mesmo estado do painel).
export default function DriverDialog({
    open,
    onOpenChange,
}: DriverDialogProps) {
    const { t } = useTranslation('workbench');
    const driver = useActiveProject((state) => state.data.driver);
    const derived = deriveDriver(driver);
    // O volume do motor (Vd) mora na seção de dimensões.
    const parameters = DRIVER_PARAMETERS.filter((key) => key !== 'vd_m3');

    return (
        <Dialog
            title={t('driverDialog.title')}
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
        >
            <div className="grid gap-6 md:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-4">
                    <DriverIdentity />
                    <fieldset className="flex flex-col">
                        <legend className="mb-1.5 text-xs font-semibold text-muted">
                            {t('driverDialog.parameters')}
                        </legend>
                        <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2">
                            {parameters.map((key) => (
                                <DriverField
                                    key={key}
                                    parameter={key as DriverKey}
                                    derived={derived}
                                />
                            ))}
                        </div>
                    </fieldset>
                </div>
                <div className="flex min-w-0 flex-col gap-4">
                    <DriverDimensions open />
                    <DriversFields />
                    <SignalFields />
                </div>
            </div>
        </Dialog>
    );
}
