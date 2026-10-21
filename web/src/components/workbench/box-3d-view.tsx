import {
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    RotateCcw,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ToggleButton } from '@/components/ui/toggle-button';
import { DEFAULT_VIEW, projectBox } from '@/cutplan';
import type { Plan, View } from '@/cutplan';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

const STEP_RAD = Math.PI / 12;
const ZOOM_STEP = 1.2;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4;
const PITCH_LIMIT = Math.PI / 2 - 0.05;
// Radianos por pixel arrastado.
const DRAG_RAD = 0.01;

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function turned(view: View, yaw: number, pitch: number): View {
    return {
        ...view,
        yaw_rad: view.yaw_rad + yaw,
        pitch_rad: clamp(view.pitch_rad + pitch, -PITCH_LIMIT, PITCH_LIMIT),
    };
}

function zoomed(view: View, factor: number): View {
    return { ...view, zoom: clamp(view.zoom * factor, ZOOM_MIN, ZOOM_MAX) };
}

function ViewButton({
    label,
    onPress,
    children,
}: {
    label: string;
    onPress: () => void;
    children: ReactNode;
}) {
    return (
        <Button
            variant="quiet"
            aria-label={label}
            onPress={onPress}
            className="size-8 px-0"
        >
            {children}
        </Button>
    );
}

// Caixa montada em projeção ortográfica desenhada em SVG (specs/005, research.md §8). A lista de
// peças continua sendo a fonte; aqui só se vê como as peças se juntam.
export function Box3dView({ plan }: { plan: Plan }) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unit = defaultUnitFor('length', unitSystem);
    const [view, setView] = useState<View>(DEFAULT_VIEW);
    const [inside, setInside] = useState(false);
    const drag = useRef<{ x: number; y: number } | null>(null);
    const { external } = plan.dimensions;
    // Meia diagonal da caixa com folga: com zoom 1 ela cabe no quadro em qualquer ângulo.
    const radius =
        (Math.hypot(external.w_m, external.h_m, external.d_m) / 2) * 1.15;
    const polygons = projectBox(plan, view, { translucent: inside });
    const format = (si: number) => formatWithUnit(si, unit, locale);

    const onKeyDown = (event: KeyboardEvent) => {
        const handlers: Record<string, () => void> = {
            ArrowLeft: () => setView((v) => turned(v, -STEP_RAD, 0)),
            ArrowRight: () => setView((v) => turned(v, STEP_RAD, 0)),
            ArrowUp: () => setView((v) => turned(v, 0, STEP_RAD)),
            ArrowDown: () => setView((v) => turned(v, 0, -STEP_RAD)),
            '+': () => setView((v) => zoomed(v, ZOOM_STEP)),
            '=': () => setView((v) => zoomed(v, ZOOM_STEP)),
            '-': () => setView((v) => zoomed(v, 1 / ZOOM_STEP)),
            Home: () => setView(DEFAULT_VIEW),
        };
        const handler = handlers[event.key];

        if (handler !== undefined) {
            event.preventDefault();
            handler();
        }
    };

    const onPointerMove = (event: PointerEvent) => {
        if (drag.current === null) {
            return;
        }

        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;

        drag.current = { x: event.clientX, y: event.clientY };
        setView((v) => turned(v, dx * DRAG_RAD, dy * DRAG_RAD));
    };

    return (
        <div className="flex flex-col gap-2">
            <svg
                role="img"
                aria-label={t('view3d.summary', {
                    type: t(`types.${plan.boxType}`),
                    width: format(external.w_m),
                    height: format(external.h_m),
                    depth: format(external.d_m),
                })}
                data-yaw={view.yaw_rad.toFixed(3)}
                data-pitch={view.pitch_rad.toFixed(3)}
                data-zoom={view.zoom.toFixed(3)}
                tabIndex={0}
                viewBox={`${-radius} ${-radius} ${2 * radius} ${2 * radius}`}
                className="h-auto max-h-[420px] w-full cursor-grab touch-none rounded-md outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-solid"
                onKeyDown={onKeyDown}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    drag.current = { x: event.clientX, y: event.clientY };
                }}
                onPointerMove={onPointerMove}
                onPointerUp={() => {
                    drag.current = null;
                }}
                onPointerCancel={() => {
                    drag.current = null;
                }}
            >
                {polygons.map((polygon) => (
                    <polygon
                        key={polygon.id}
                        data-id={polygon.id}
                        // O eixo y do SVG cresce para baixo.
                        points={polygon.points
                            .map(([x, y]) => `${x},${-y}`)
                            .join(' ')}
                        className={
                            polygon.kind === 'cutout'
                                ? 'fill-background stroke-foreground'
                                : inside
                                  ? 'fill-accent-soft stroke-foreground'
                                  : 'fill-raised stroke-foreground'
                        }
                        fillOpacity={
                            inside && polygon.kind === 'face' ? 0.35 : 1
                        }
                        strokeWidth={radius * 0.006}
                        strokeLinejoin="round"
                    />
                ))}
            </svg>
            <p className="text-[11px] text-muted">{t('view3d.hint')}</p>
            <div
                role="group"
                aria-label={t('view3d.controls')}
                className="flex flex-wrap items-center gap-1"
            >
                <ViewButton
                    label={t('view3d.rotateLeft')}
                    onPress={() => setView((v) => turned(v, -STEP_RAD, 0))}
                >
                    <ChevronLeft aria-hidden="true" className="size-4" />
                </ViewButton>
                <ViewButton
                    label={t('view3d.rotateRight')}
                    onPress={() => setView((v) => turned(v, STEP_RAD, 0))}
                >
                    <ChevronRight aria-hidden="true" className="size-4" />
                </ViewButton>
                <ViewButton
                    label={t('view3d.rotateUp')}
                    onPress={() => setView((v) => turned(v, 0, STEP_RAD))}
                >
                    <ChevronUp aria-hidden="true" className="size-4" />
                </ViewButton>
                <ViewButton
                    label={t('view3d.rotateDown')}
                    onPress={() => setView((v) => turned(v, 0, -STEP_RAD))}
                >
                    <ChevronDown aria-hidden="true" className="size-4" />
                </ViewButton>
                <ViewButton
                    label={t('view3d.zoomIn')}
                    onPress={() => setView((v) => zoomed(v, ZOOM_STEP))}
                >
                    <ZoomIn aria-hidden="true" className="size-4" />
                </ViewButton>
                <ViewButton
                    label={t('view3d.zoomOut')}
                    onPress={() => setView((v) => zoomed(v, 1 / ZOOM_STEP))}
                >
                    <ZoomOut aria-hidden="true" className="size-4" />
                </ViewButton>
                <ViewButton
                    label={t('view3d.reset')}
                    onPress={() => setView(DEFAULT_VIEW)}
                >
                    <RotateCcw aria-hidden="true" className="size-4" />
                </ViewButton>
                <ToggleButton
                    pressed={inside}
                    onPressedChange={setInside}
                    className="h-8 w-auto px-3 text-sm"
                >
                    {t('view3d.inside')}
                </ToggleButton>
            </div>
        </div>
    );
}

export default Box3dView;
