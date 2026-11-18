import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import type { PortInput, PortPlacement } from '@/engine';
import { DEFAULT_PLACEMENT } from '@/cutplan/plan';
import { useActiveProject } from '@/hooks/use-active-project';
import { clearPortPositions } from '@/lib/project/fields';

// Ordem do menu: os cantos (o padrão primeiro), as bordas e a fila com o alto-falante.
const PLACEMENTS: PortPlacement[] = [
    'bottomRight',
    'bottomLeft',
    'topRight',
    'topLeft',
    'bottom',
    'top',
    'right',
    'left',
    'auto',
];

type Props = {
    port: PortInput;
    setPort: (port: PortInput) => void;
    // Peça em que os dutos deste bloco são recortados (frontal ou traseira da 6ª ordem).
    piece: 'front' | 'back';
};

// Onde os dutos ficam no painel: só desenho (plano de corte e 3D), não muda a acústica.
export function PortPlacementField({ port, setPort, piece }: Props) {
    const { t } = useTranslation('workbench');
    const apply = useActiveProject((state) => state.apply);
    // Duto movido à mão no plano de corte: a escolha do menu não vale para ele.
    const manual = useActiveProject(
        (state) =>
            state.data.cutPlan?.positions?.some(
                (item) => item.piece === piece && item.kind === 'port',
            ) ?? false,
    );
    const clearManual = () => apply((data) => clearPortPositions(data, piece));

    return (
        <div className="flex flex-col gap-1">
            <SelectField<PortPlacement>
                label={t('port.placement')}
                selected={port.placement ?? DEFAULT_PLACEMENT}
                onChange={(placement) => {
                    setPort({ ...port, placement });
                    // Escolher no menu volta os dutos ao posicionamento automático.
                    if (manual) {
                        clearManual();
                    }
                }}
                options={PLACEMENTS.map((id) => ({
                    id,
                    label: t(`port.placement_${id}`),
                }))}
            />
            {manual && (
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] leading-4 text-muted">
                    <span>{t('port.placementManual')}</span>
                    <Button
                        variant="quiet"
                        onPress={clearManual}
                        className="h-6 gap-1 px-1.5 text-[11px]"
                    >
                        <RotateCcw aria-hidden="true" className="size-3" />
                        {t('port.placementReset')}
                    </Button>
                </div>
            )}
        </div>
    );
}
