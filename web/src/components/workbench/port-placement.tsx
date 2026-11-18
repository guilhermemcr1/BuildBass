import { RotateCcw } from 'lucide-react';
import { Label, Radio, RadioGroup } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Switch } from '@/components/ui/switch';
import type { PortInput, PortPlacement, PortRotation } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { clearPortPositions } from '@/lib/project/fields';
import { cn } from '@/lib/utils';

// Grade 3 × 3 na mesma disposição do painel: cantos, bordas e, no meio, o automático.
const GRID: PortPlacement[] = [
    'topLeft',
    'top',
    'topRight',
    'left',
    'auto',
    'right',
    'bottomLeft',
    'bottom',
    'bottomRight',
];

// Marca do duto dentro da célula: onde ele fica no painel.
const MARK: Record<PortPlacement, string> = {
    auto: '',
    top: 'top-1 left-1/2 h-1 w-4 -translate-x-1/2',
    bottom: 'bottom-1 left-1/2 h-1 w-4 -translate-x-1/2',
    left: 'top-1/2 left-1 h-4 w-1 -translate-y-1/2',
    right: 'top-1/2 right-1 h-4 w-1 -translate-y-1/2',
    topLeft: 'top-1 left-1 size-2',
    topRight: 'top-1 right-1 size-2',
    bottomLeft: 'bottom-1 left-1 size-2',
    bottomRight: 'bottom-1 right-1 size-2',
};

const ROTATIONS: PortRotation[] = [0, 90, 180, 270];

type Props = {
    port: PortInput;
    setPort: (port: PortInput) => void;
    // Peça em que os dutos deste bloco são recortados (frontal ou traseira da 6ª ordem).
    piece: 'front' | 'back';
};

// Posição dos dutos no painel: só desenho (plano de corte e 3D), não muda a acústica.
export function PortPlacementFields({ port, setPort, piece }: Props) {
    const { t } = useTranslation('workbench');
    const placement = port.placement ?? 'auto';
    const apply = useActiveProject((state) => state.apply);
    // Duto movido à mão no diálogo de posição: a escolha da grade não vale para ele.
    const manual = useActiveProject(
        (state) =>
            state.data.cutPlan?.positions?.some(
                (item) => item.piece === piece && item.kind === 'port',
            ) ?? false,
    );
    const clearManual = () => apply((data) => clearPortPositions(data, piece));

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
                <RadioGroup
                    value={placement}
                    onChange={(value) => {
                        setPort({
                            ...port,
                            placement: value as PortPlacement,
                        });
                        // Escolher na grade volta os dutos ao posicionamento automático.
                        if (manual) {
                            clearManual();
                        }
                    }}
                    className="flex flex-col gap-1.5"
                >
                    <Label className="text-xs font-semibold text-muted">
                        {t('port.placement')}
                    </Label>
                    <div className="grid w-fit grid-cols-3 gap-1">
                        {GRID.map((id) => (
                            <Radio
                                key={id}
                                value={id}
                                aria-label={t(`port.placement_${id}`)}
                                className={cn(
                                    'relative grid size-9 cursor-default place-items-center rounded-md border border-border bg-raised text-[10px] text-muted outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:border-muted data-[selected]:border-accent data-[selected]:bg-accent-soft data-[selected]:text-foreground motion-safe:transition-colors',
                                    manual && 'opacity-60',
                                )}
                            >
                                {id === 'auto' ? (
                                    t('port.placementAutoShort')
                                ) : (
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            'absolute rounded-[1px] bg-current',
                                            MARK[id],
                                        )}
                                    />
                                )}
                            </Radio>
                        ))}
                    </div>
                </RadioGroup>
                <div className="flex min-w-0 flex-1 flex-col gap-2 pt-5">
                    <p className="text-[13px] text-foreground">
                        {manual
                            ? t('port.placementManual')
                            : t(`port.placement_${placement}`)}
                    </p>
                    {manual && (
                        <Button
                            variant="quiet"
                            onPress={clearManual}
                            className="w-fit gap-1.5 px-2 text-xs"
                        >
                            <RotateCcw
                                aria-hidden="true"
                                className="size-3.5"
                            />
                            {t('port.placementReset')}
                        </Button>
                    )}
                    <Switch
                        selected={port.against_wall === true}
                        onChange={(selected) =>
                            setPort({
                                ...port,
                                against_wall: selected || undefined,
                            })
                        }
                        disabled={manual}
                    >
                        {t('port.againstWall')}
                    </Switch>
                </div>
            </div>
            {port.shape !== 'round' && (
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted">
                        {t('port.rotation')}
                    </span>
                    <SegmentedControl<string>
                        label={t('port.rotation')}
                        size="sm"
                        selected={String(port.rotation ?? 0)}
                        onChange={(id) =>
                            setPort({
                                ...port,
                                rotation: Number(id) as PortRotation,
                            })
                        }
                        options={ROTATIONS.map((deg) => ({
                            id: String(deg),
                            label: `${deg}°`,
                        }))}
                        className="w-full"
                    />
                </div>
            )}
        </div>
    );
}
