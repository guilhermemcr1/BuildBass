import { Box } from 'lucide-react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { DEFAULT_VIEW, projectBox } from '@/cutplan';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { cn } from '@/lib/utils';

type BoxThumbnailProps = {
    onPress: () => void;
    className?: string;
};

// Miniatura estática da caixa (a mesma projeção do 3D, sem cotas nem interação). É um botão que
// abre o modal da caixa; sem plano pronto, um espaço reservado com o ícone.
export function BoxThumbnail({ onPress, className }: BoxThumbnailProps) {
    const { t } = useTranslation('workbench');
    const cutPlan = useCutPlan();
    const ready = cutPlan.status === 'ready';
    const polygons = ready
        ? projectBox(cutPlan.plan, DEFAULT_VIEW, { translucent: false })
        : [];
    const { external } = ready
        ? cutPlan.plan.dimensions
        : { external: { w_m: 1, h_m: 1, d_m: 1 } };
    const radius =
        (Math.hypot(external.w_m, external.h_m, external.d_m) / 2) * 1.1;

    return (
        <AriaButton
            aria-label={t('boxDialog.open3d')}
            aria-description={ready ? undefined : t('boxDialog.thumbnailEmpty')}
            onPress={onPress}
            className={cn(
                'flex h-28 w-full cursor-default items-center justify-center rounded-md border border-border bg-raised outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:border-muted',
                className,
            )}
        >
            {ready ? (
                <svg
                    aria-hidden="true"
                    viewBox={`${-radius} ${-radius} ${2 * radius} ${2 * radius}`}
                    className="h-full w-auto p-1"
                >
                    {polygons.map((polygon) => (
                        <polygon
                            key={polygon.id}
                            points={polygon.points
                                .map(([x, y]) => `${x},${-y}`)
                                .join(' ')}
                            className={
                                polygon.part === 'driver'
                                    ? 'fill-accent-soft stroke-accent'
                                    : polygon.kind === 'cutout'
                                      ? 'fill-background stroke-foreground'
                                      : 'fill-surface stroke-foreground'
                            }
                            strokeWidth={radius * 0.012}
                            strokeLinejoin="round"
                        />
                    ))}
                </svg>
            ) : (
                <span className="flex flex-col items-center gap-1 px-3 text-center text-[11px] text-muted">
                    <Box aria-hidden="true" className="size-6" />
                    {t('boxDialog.open3d')}
                </span>
            )}
        </AriaButton>
    );
}

export default BoxThumbnail;
