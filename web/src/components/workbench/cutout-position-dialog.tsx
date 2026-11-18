import { useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { ParameterField } from '@/components/ui/parameter-field';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { cutoutExtent, svgTriangle } from '@/cutplan';
import type { Cutout, CutoutPiece, CutoutRef, Piece } from '@/cutplan';
import { useActiveProject } from '@/hooks/use-active-project';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { cutoutName, pieceName } from '@/lib/cut-plan-text';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import {
    clearCutoutPosition,
    clearPiecePositions,
    setCutoutPosition,
} from '@/lib/project/fields';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import type { UnitId } from '@/lib/units/quantities';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';

// O desenho usa milímetros como unidade de tela.
const MM = 1000;
const STEP_M = 0.001;
const BIG_STEP_M = 0.01;

type Center = { x_m: number; y_m: number };

const sameRef = (a: CutoutRef | undefined, b: CutoutRef | undefined) =>
    a !== undefined &&
    b !== undefined &&
    a.piece === b.piece &&
    a.kind === b.kind &&
    a.n === b.n;

const refKey = (ref: CutoutRef) => `${ref.kind}-${ref.n}`;

// Retângulo que envolve o recorte, em metros (com o giro do triangular).
function extent(cutout: Cutout): { w: number; h: number } {
    const { w, h } = cutoutExtent(cutout);

    return { w: w ?? 0, h: h ?? 0 };
}

const roundMm = (meters: number) => Math.round(meters / STEP_M) * STEP_M;

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));

function CutoutMark({
    cutout,
    center,
    height,
    selected,
    stroke,
}: {
    cutout: Cutout;
    center: Center;
    height: number;
    selected: boolean;
    stroke: number;
}) {
    const cx = center.x_m * MM;
    const cy = height - center.y_m * MM;
    const { w, h } = extent(cutout);
    const className = cn(
        'stroke-foreground',
        selected ? 'fill-accent' : 'fill-accent-soft',
    );

    if (cutout.shape === 'round') {
        return (
            <circle
                cx={cx}
                cy={cy}
                r={(w * MM) / 2}
                className={className}
                strokeWidth={stroke}
            />
        );
    }

    if (cutout.shape === 'triangle') {
        return (
            <polygon
                points={svgTriangle(
                    cx,
                    cy,
                    (cutout.base_m ?? 0) * MM,
                    (cutout.height_m ?? 0) * MM,
                    cutout.rotation_deg,
                )}
                className={className}
                strokeWidth={stroke}
            />
        );
    }

    return (
        <rect
            x={cx - (w * MM) / 2}
            y={cy - (h * MM) / 2}
            width={w * MM}
            height={h * MM}
            className={className}
            strokeWidth={stroke}
        />
    );
}

type Drag = { ref: CutoutRef; offset: Center; center: Center };

function Editor({ piece, role }: { piece: Piece; role: CutoutPiece }) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const apply = useActiveProject((state) => state.apply);
    const fieldUnits = useActiveProject((state) => state.data.fieldUnits);
    const setFieldUnit = useActiveProject((state) => state.setFieldUnit);
    const unitSystem = usePreferences((state) => state.unitSystem);
    const plan = useCutPlan();
    const svgRef = useRef<SVGSVGElement>(null);
    const movable = piece.cutouts.filter(
        (cutout): cutout is Cutout & { ref: CutoutRef; center: Center } =>
            cutout.ref !== undefined && cutout.center !== undefined,
    );
    const pending = piece.cutouts.filter(
        (cutout) => cutout.ref !== undefined && cutout.center === undefined,
    );
    const [selectedRef, setSelectedRef] = useState<CutoutRef | undefined>(
        movable[0]?.ref,
    );
    const [drag, setDrag] = useState<Drag | undefined>();
    const [announcement, setAnnouncement] = useState('');
    const selected =
        movable.find((cutout) => sameRef(cutout.ref, selectedRef)) ??
        movable[0];
    const width = piece.w_m * MM;
    const height = piece.h_m * MM;
    const size = Math.max(width, height) * 0.03;
    const pad = size * 1.5;
    const length = (si: number) =>
        formatWithUnit(si, defaultUnitFor('length', unitSystem), locale);
    const warnings =
        plan.status === 'ready'
            ? plan.plan.warnings.filter(
                  (warning) =>
                      warning.piece === role && warning.cutout !== undefined,
              )
            : [];

    const announce = (ref: CutoutRef, center: Center) =>
        setAnnouncement(
            t('position.announce', {
                cutout: cutoutName(ref, t),
                x: length(center.x_m),
                y: length(center.y_m),
            }),
        );

    const save = (ref: CutoutRef, center: Center) => {
        apply((data) => setCutoutPosition(data, ref, center.x_m, center.y_m));
        announce(ref, center);
    };

    // Ponto da tela → metros na peça (origem no canto inferior esquerdo). O SVG mantém a proporção
    // do `viewBox` ("meet"), então a escala é a menor das duas e o desenho fica centralizado.
    const toPiece = (clientX: number, clientY: number): Center | undefined => {
        const svg = svgRef.current;

        if (svg === null) {
            return undefined;
        }

        const box = svg.getBoundingClientRect();
        const viewW = width + 2 * pad;
        const viewH = height + 2 * pad;
        const scale = Math.min(box.width / viewW, box.height / viewH);

        if (!(scale > 0)) {
            return undefined;
        }

        const x =
            (clientX - box.left - (box.width - viewW * scale) / 2) / scale -
            pad;
        const y =
            (clientY - box.top - (box.height - viewH * scale) / 2) / scale -
            pad;

        return { x_m: x / MM, y_m: (height - y) / MM };
    };

    const onPointerDown = (
        event: PointerEvent<SVGGElement>,
        cutout: (typeof movable)[number],
    ) => {
        const point = toPiece(event.clientX, event.clientY);

        setSelectedRef(cutout.ref);

        if (point === undefined) {
            return;
        }

        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDrag({
            ref: cutout.ref,
            offset: {
                x_m: cutout.center.x_m - point.x_m,
                y_m: cutout.center.y_m - point.y_m,
            },
            center: cutout.center,
        });
    };

    const onPointerMove = (event: PointerEvent<SVGGElement>) => {
        const point = toPiece(event.clientX, event.clientY);

        if (drag === undefined || point === undefined) {
            return;
        }

        // Durante o arrasto o centro é só local e fica dentro da peça, em passos de 1 mm.
        setDrag({
            ...drag,
            center: {
                x_m: roundMm(clamp(point.x_m + drag.offset.x_m, piece.w_m)),
                y_m: roundMm(clamp(point.y_m + drag.offset.y_m, piece.h_m)),
            },
        });
    };

    // Soltar grava uma vez: o arrasto inteiro é uma etapa do Desfazer.
    const onPointerUp = () => {
        if (drag === undefined) {
            return;
        }

        const moved = movable.find((cutout) => sameRef(cutout.ref, drag.ref));

        if (
            moved !== undefined &&
            (moved.center.x_m !== drag.center.x_m ||
                moved.center.y_m !== drag.center.y_m)
        ) {
            save(drag.ref, drag.center);
        }

        setDrag(undefined);
    };

    const onKeyDown = (
        event: KeyboardEvent<SVGGElement>,
        cutout: (typeof movable)[number],
    ) => {
        const step = event.shiftKey ? BIG_STEP_M : STEP_M;
        const delta: Record<string, Center> = {
            ArrowLeft: { x_m: -step, y_m: 0 },
            ArrowRight: { x_m: step, y_m: 0 },
            ArrowUp: { x_m: 0, y_m: step },
            ArrowDown: { x_m: 0, y_m: -step },
        };
        const move = delta[event.key];

        if (move === undefined) {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedRef(cutout.ref);
            }

            return;
        }

        event.preventDefault();
        setSelectedRef(cutout.ref);
        save(cutout.ref, {
            x_m: clamp(cutout.center.x_m + move.x_m, piece.w_m),
            y_m: clamp(cutout.center.y_m + move.y_m, piece.h_m),
        });
    };

    const field = (axis: 'x_m' | 'y_m') => {
        const parameter: ParameterKey =
            axis === 'x_m' ? 'cutpos_x_m' : 'cutpos_y_m';

        return {
            parameter,
            valueSi: selected?.center[axis],
            unit:
                fieldUnits[parameter] ??
                defaultUnitFor(PARAMETERS[parameter].quantity, unitSystem),
            onUnitChange: (unit: UnitId) => setFieldUnit(parameter, unit),
            onChangeSi: (si: number | undefined) => {
                if (selected === undefined || si === undefined) {
                    return;
                }

                save(selected.ref, { ...selected.center, [axis]: si });
            },
            labelContext:
                selected === undefined
                    ? undefined
                    : cutoutName(selected.ref, t),
            layout: 'row' as const,
            disabled: selected === undefined,
        };
    };

    if (movable.length === 0) {
        return (
            <p className="text-sm text-muted">{t('position.noneMovable')}</p>
        );
    }

    return (
        <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-xs text-muted">{t('position.hint')}</p>
                <svg
                    ref={svgRef}
                    role="group"
                    aria-label={t('position.drawing', {
                        piece: pieceName(piece.role, t).toLowerCase(),
                    })}
                    viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}
                    className="h-auto max-h-[60dvh] w-full touch-none select-none"
                >
                    <rect
                        x={0}
                        y={0}
                        width={width}
                        height={height}
                        className="fill-raised stroke-foreground"
                        strokeWidth={size * 0.12}
                    />
                    {movable.map((cutout) => {
                        const dragging = sameRef(drag?.ref, cutout.ref);
                        const center =
                            dragging && drag !== undefined
                                ? drag.center
                                : cutout.center;
                        const chosen = sameRef(selected?.ref, cutout.ref);
                        const name = cutoutName(cutout.ref, t);

                        return (
                            <g
                                key={refKey(cutout.ref)}
                                role="button"
                                tabIndex={0}
                                aria-pressed={chosen}
                                aria-label={`${name}, ${t(
                                    cutout.manual === true
                                        ? 'position.manual'
                                        : 'position.auto',
                                )}`}
                                data-cutout={refKey(cutout.ref)}
                                data-manual={cutout.manual === true}
                                className="cursor-grab outline-none focus-visible:[&>*]:stroke-accent"
                                onPointerDown={(event) =>
                                    onPointerDown(event, cutout)
                                }
                                onPointerMove={onPointerMove}
                                onPointerUp={onPointerUp}
                                onPointerCancel={() => setDrag(undefined)}
                                onKeyDown={(event) => onKeyDown(event, cutout)}
                                onFocus={() => setSelectedRef(cutout.ref)}
                            >
                                <CutoutMark
                                    cutout={cutout}
                                    center={center}
                                    height={height}
                                    selected={chosen}
                                    stroke={size * (chosen ? 0.2 : 0.1)}
                                />
                                <text
                                    x={center.x_m * MM}
                                    y={height - center.y_m * MM}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fontSize={size}
                                    className="pointer-events-none fill-foreground"
                                >
                                    {name}
                                </text>
                            </g>
                        );
                    })}
                </svg>
                {pending.length > 0 && (
                    <ul className="text-xs text-muted">
                        {pending.map((cutout) =>
                            cutout.ref === undefined ? null : (
                                <li key={refKey(cutout.ref)}>
                                    {t('position.pending', {
                                        cutout: cutoutName(cutout.ref, t),
                                    })}
                                </li>
                            ),
                        )}
                    </ul>
                )}
            </div>
            <div className="flex flex-col gap-3 md:w-72">
                <h3 className="text-section">
                    {selected === undefined
                        ? ''
                        : `${cutoutName(selected.ref, t)} · ${t(
                              selected.manual === true
                                  ? 'position.manual'
                                  : 'position.auto',
                          )}`}
                </h3>
                <ParameterField {...field('x_m')} />
                <ParameterField {...field('y_m')} />
                <div className="flex flex-wrap gap-2">
                    <Button
                        disabled={selected?.manual !== true}
                        onPress={() => {
                            if (selected === undefined) {
                                return;
                            }

                            apply((data) =>
                                clearCutoutPosition(data, selected.ref),
                            );
                            setAnnouncement(
                                t('position.resetDone', {
                                    cutout: cutoutName(selected.ref, t),
                                }),
                            );
                        }}
                    >
                        {t('position.reset')}
                    </Button>
                    <Button
                        variant="quiet"
                        disabled={
                            !movable.some((cutout) => cutout.manual === true)
                        }
                        onPress={() => {
                            apply((data) => clearPiecePositions(data, role));
                            setAnnouncement(t('position.resetAllDone'));
                        }}
                    >
                        {t('position.resetAll')}
                    </Button>
                </div>
                {warnings.length > 0 && (
                    <ul
                        className="flex flex-col gap-1.5"
                        aria-label={t('warnings.title')}
                    >
                        {warnings.map((warning) => {
                            const text = t(`warnings.${warning.id}`, {
                                piece: pieceName(piece.role, t).toLowerCase(),
                                cutout:
                                    warning.cutout === undefined
                                        ? ''
                                        : cutoutName(warning.cutout, t),
                                thickness: length(piece.thickness_m),
                            });

                            return (
                                <li
                                    key={`${warning.id}-${warning.cutout === undefined ? '' : refKey(warning.cutout)}`}
                                >
                                    <StatusIndicator
                                        status={
                                            warning.tone === 'error'
                                                ? 'error'
                                                : 'warn'
                                        }
                                        label={text}
                                        className="items-start text-sm [&>svg]:mt-0.5"
                                    />
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p role="status" aria-live="polite" className="sr-only">
                    {announcement}
                </p>
            </div>
        </div>
    );
}

type CutoutPositionDialogProps = {
    piece: CutoutPiece;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

// Posicionar os recortes de uma peça: desenho grande com arrasto e
// teclado, campos do centro, voltar ao automático e os avisos da peça. Lê o plano vivo: cada
// gravação refaz o plano e o desenho acompanha.
export default function CutoutPositionDialog({
    piece: role,
    open,
    onOpenChange,
}: CutoutPositionDialogProps) {
    const { t } = useTranslation('cutplan');
    const plan = useCutPlan();
    const piece =
        plan.status === 'ready'
            ? plan.plan.pieces.find((item) => item.role === role)
            : undefined;

    return (
        <Dialog
            title={t('position.title', { piece: pieceName(role, t) })}
            open={open}
            onOpenChange={onOpenChange}
            size="lg"
        >
            {piece === undefined ? (
                <p className="text-sm text-muted">
                    {t('position.unavailable')}
                </p>
            ) : (
                <Editor piece={piece} role={role} />
            )}
        </Dialog>
    );
}
