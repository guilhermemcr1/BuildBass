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
import { Switch } from '@/components/ui/switch';
import { DEFAULT_VIEW, dimensionLines, projectBox } from '@/cutplan';
import type { Plan, Polygon, View } from '@/cutplan';
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

// Tom da face pela luz: de `raised` (iluminada) até um pouco de `foreground` (na sombra).
function faceTone(light: number) {
    return `color-mix(in oklab, var(--color-foreground) ${Math.round(4 + (1 - light) * 18)}%, var(--color-raised))`;
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

type Look = {
    className: string;
    // Cor de preenchimento calculada (tom da luz); sem ela vale a classe.
    fill?: string;
    fillOpacity: number;
    strokeOpacity: number;
    // Espessura do traço, em fração do raio do quadro.
    stroke: number;
};

// Aparência de cada polígono: faces com o tom da luz, furos escuros e, dentro do recorte, o
// alto-falante (aro, suspensão, cone e capa) e as paredes do duto.
function lookOf(polygon: Polygon, inside: boolean, behind: boolean): Look {
    if (polygon.kind === 'detail') {
        if (polygon.layer === 'wall') {
            return {
                className: 'stroke-foreground',
                fill: `color-mix(in oklab, var(--color-foreground) ${Math.round(45 + (1 - polygon.light) * 35)}%, var(--color-raised))`,
                fillOpacity: behind ? 0.35 : 1,
                // Traço quase invisível: com ele, as muitas paredes de um duto redondo viram listras.
                strokeOpacity: 0.1,
                stroke: 0.003,
            };
        }

        const layers = {
            flange: {
                className: 'fill-foreground stroke-foreground',
                opacity: 0.9,
            },
            cone: { className: 'fill-foreground stroke-muted', opacity: 0.75 },
            cap: { className: 'fill-accent stroke-accent-soft', opacity: 1 },
        } as const;
        const layer = layers[polygon.layer ?? 'cone'];

        return {
            className: layer.className,
            fillOpacity: behind ? layer.opacity * 0.5 : layer.opacity,
            strokeOpacity: 0.75,
            stroke: 0.004,
        };
    }

    if (polygon.kind === 'cutout') {
        // O furo do alto-falante é a suspensão, de tom claro entre o aro e o cone; o do duto é escuro.
        return polygon.part === 'driver'
            ? {
                  className: 'fill-muted stroke-foreground',
                  fillOpacity: behind ? 0.5 : 1,
                  strokeOpacity: 0.9,
                  stroke: 0.004,
              }
            : {
                  className: 'fill-foreground stroke-foreground',
                  fillOpacity: behind ? 0.15 : 0.85,
                  strokeOpacity: 0.9,
                  stroke: 0.005,
              };
    }

    return inside
        ? {
              className: 'fill-accent-soft stroke-foreground',
              fillOpacity: behind ? 0.12 : 0.35,
              strokeOpacity: 0.75,
              stroke: 0.005,
          }
        : {
              className: 'stroke-foreground',
              fill: faceTone(polygon.light),
              fillOpacity: 1,
              strokeOpacity: 0.75,
              stroke: 0.005,
          };
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
    // As cotas ficam fora da caixa, então o quadro ganha folga para elas e para o texto.
    const radius =
        (Math.hypot(external.w_m, external.h_m, external.d_m) / 2) * 1.35;
    const polygons = projectBox(plan, view, { translucent: inside });
    const lines = dimensionLines(plan, view);
    const format = (si: number) => formatWithUnit(si, unit, locale);
    const driverOnFront = projectBox(
        plan,
        { yaw_rad: 0, pitch_rad: 0, zoom: 1 },
        { translucent: false },
    ).some((polygon) => polygon.part === 'driver');
    const fontSize = radius * 0.07;

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
                }).concat(driverOnFront ? ` ${t('view3d.summaryDriver')}` : '')}
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
                {polygons.map((polygon) => {
                    // Por dentro, o que está atrás fica tracejado e fraco para não competir com a frente.
                    const behind = inside && !polygon.facing;
                    const look = lookOf(polygon, inside, behind);

                    return (
                        <polygon
                            key={polygon.id}
                            data-id={polygon.id}
                            data-part={polygon.part}
                            data-layer={polygon.layer}
                            // O eixo y do SVG cresce para baixo.
                            points={polygon.points
                                .map(([x, y]) => `${x},${-y}`)
                                .join(' ')}
                            className={look.className}
                            // Cada face recebe um tom da luz; o volume se lê sem contorno pesado.
                            style={
                                look.fill === undefined
                                    ? undefined
                                    : { fill: look.fill }
                            }
                            fillOpacity={look.fillOpacity}
                            strokeOpacity={behind ? 0.4 : look.strokeOpacity}
                            strokeDasharray={
                                behind
                                    ? `${radius * 0.015} ${radius * 0.012}`
                                    : undefined
                            }
                            strokeWidth={radius * look.stroke}
                            strokeLinejoin="round"
                        />
                    );
                })}
                {lines.map((line) => {
                    const dx = line.to[0] - line.from[0];
                    const dy = line.to[1] - line.from[1];
                    const length = Math.hypot(dx, dy) || 1;
                    // Normal da cota (para fora da caixa): dela saem as linhas de chamada e os traços.
                    const nx = -dy / length;
                    const ny = dx / length;
                    const side = Math.sign(
                        (line.from[0] - line.edge[0][0]) * nx +
                            (line.from[1] - line.edge[0][1]) * ny,
                    );
                    const tick = radius * 0.015;
                    const ends = [
                        [line.edge[0], line.from],
                        [line.edge[1], line.to],
                    ] as const;
                    // Prolonga a chamada um pouco além da cota, como no desenho técnico.
                    const overshoot = radius * 0.012;
                    const extensions = ends
                        .map(([edge, end]) => {
                            const ex = end[0] - edge[0];
                            const ey = end[1] - edge[1];
                            const el = Math.hypot(ex, ey) || 1;

                            return `M${edge[0]},${-edge[1]}L${end[0] + (ex / el) * overshoot},${-(end[1] + (ey / el) * overshoot)}`;
                        })
                        .join('');
                    const ticks = ends
                        .map(
                            ([, end]) =>
                                `M${end[0] - (nx * side + dx / length) * tick},${-(end[1] - (ny * side + dy / length) * tick)}L${end[0] + (nx * side + dx / length) * tick},${-(end[1] + (ny * side + dy / length) * tick)}`,
                        )
                        .join('');

                    return (
                        <g
                            key={line.axis}
                            data-dimension={line.axis}
                            className="stroke-muted"
                            fill="none"
                        >
                            <line
                                x1={line.from[0]}
                                y1={-line.from[1]}
                                x2={line.to[0]}
                                y2={-line.to[1]}
                                strokeWidth={radius * 0.005}
                            />
                            <path
                                d={extensions + ticks}
                                strokeWidth={radius * 0.004}
                                strokeOpacity={0.8}
                            />
                            <text
                                x={line.label[0]}
                                y={-line.label[1]}
                                fontSize={fontSize}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="fill-foreground stroke-background"
                                strokeWidth={fontSize * 0.7}
                                strokeOpacity={1}
                                strokeLinejoin="round"
                                style={{ paintOrder: 'stroke' }}
                            >
                                {format(line.value_m)}
                            </text>
                        </g>
                    );
                })}
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
                <Switch selected={inside} onChange={setInside} className="ml-2">
                    {t('view3d.inside')}
                </Switch>
            </div>
        </div>
    );
}

export default Box3dView;
