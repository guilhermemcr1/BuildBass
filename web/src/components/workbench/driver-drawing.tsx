import { useState } from 'react';
import type { FocusEvent, PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { ParameterKey } from '@/lib/parameters';
import type { DriverPiston, DriverShape } from '@/lib/project/types';
import { cn } from '@/lib/utils';

// Letra do esquema de cada campo de medida.
export const DRAWING_LETTER: Partial<Record<ParameterKey, string>> = {
    drv_a_m: 'A',
    drv_b_m: 'B',
    cutout_m: 'C',
    drv_d_m: 'D',
    drv_e_m: 'E',
    drv_f_m: 'F',
    drv_g_m: 'G',
};

type Point = { x: number; y: number };

// Cota: linha com travessões nas pontas, linhas de chamada opcionais até a peça e a letra ao lado.
// A cota do campo em foco ganha traço grosso e letra maior; as outras recuam.
function Dim({
    from,
    to,
    label,
    at,
    active,
    dimmed,
    extensions = [],
    anchor = 'middle',
    narrow = false,
}: {
    from: Point;
    to: Point;
    label: string;
    at: Point;
    active: boolean;
    dimmed: boolean;
    extensions?: [Point, Point][];
    anchor?: 'start' | 'middle' | 'end';
    // Medida estreita (horizontal): setas de fora para dentro, sem travessões que virariam um "H".
    narrow?: boolean;
}) {
    const vertical = from.x === to.x;
    const tick = active ? 4 : 3;

    return (
        <g
            data-dim={label}
            data-active={active || undefined}
            className={cn(
                'stroke-accent motion-safe:transition-opacity motion-safe:duration-150',
                dimmed && 'opacity-35',
            )}
            strokeWidth={active ? 2 : 1}
        >
            {extensions.map(([a, b], index) => (
                <line
                    key={index}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    strokeWidth={0.75}
                    strokeDasharray="2 2"
                    strokeOpacity={0.7}
                />
            ))}
            {narrow ? (
                <>
                    <line
                        x1={from.x - 12}
                        y1={from.y}
                        x2={to.x + 12}
                        y2={to.y}
                    />
                    <path
                        d={`M${from.x} ${from.y} l-5 -3 v6 z M${to.x} ${to.y} l5 -3 v6 z`}
                        className="fill-accent"
                        strokeWidth={0.5}
                    />
                </>
            ) : vertical ? (
                <>
                    <line
                        x1={from.x - tick}
                        y1={from.y}
                        x2={from.x + tick}
                        y2={from.y}
                    />
                    <line
                        x1={to.x - tick}
                        y1={to.y}
                        x2={to.x + tick}
                        y2={to.y}
                    />
                </>
            ) : (
                <>
                    <line
                        x1={from.x}
                        y1={from.y - tick}
                        x2={from.x}
                        y2={from.y + tick}
                    />
                    <line
                        x1={to.x}
                        y1={to.y - tick}
                        x2={to.x}
                        y2={to.y + tick}
                    />
                </>
            )}
            {!narrow && <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />}
            <text
                x={at.x}
                y={at.y}
                className={cn(
                    'stroke-none font-semibold',
                    active ? 'fill-accent' : 'fill-accent-soft',
                )}
                fontSize={active ? 14 : 11}
                textAnchor={anchor}
                dominantBaseline="central"
            >
                {label}
            </text>
        </g>
    );
}

// Campo em foco (ou sob o mouse) dentro da lista de medidas, para destacar a cota no esquema.
// Lê o `data-parameter` que cada ParameterField já expõe; o foco tem prioridade sobre o mouse.
export function useDrawingFocus() {
    const [focused, setFocused] = useState<string>();
    const [hovered, setHovered] = useState<string>();
    const letterOf = (target: EventTarget) => {
        const key =
            target instanceof Element
                ? target.closest<HTMLElement>('[data-parameter]')?.dataset
                      .parameter
                : undefined;

        return key === undefined
            ? undefined
            : DRAWING_LETTER[key as ParameterKey];
    };

    return {
        active: focused ?? hovered,
        handlers: {
            onFocus: (event: FocusEvent) => setFocused(letterOf(event.target)),
            onBlur: () => setFocused(undefined),
            onPointerOver: (event: PointerEvent) =>
                setHovered(letterOf(event.target)),
            onPointerLeave: () => setHovered(undefined),
        },
    };
}

// Geometria do corte lateral (unidades do viewBox; esquema, não escala).
const TOP = 26; // topo do aro
const BOTTOM = 126; // base do aro
const MID = (TOP + BOTTOM) / 2;
const RIM_X = 74; // face do aro (frente da caixa)
const RIM_W = 8; // espessura do aro (F)
const BACK = RIM_X + RIM_W;
const MAGNET_X = 136;
const MAGNET_END = 182;
const MAGNET_H = 40;
const CONE_IN = 12; // o cone começa um pouco para dentro do aro
const FRONT_X = 246; // centro da vista frontal

// Corte lateral do alto-falante (aro, cone ou domo, cesto e ímã) com as cotas A–G e, ao lado, a
// vista frontal no formato escolhido. `active` destaca a letra do campo em foco.
export function DriverDrawing({
    shape,
    piston,
    active,
}: {
    shape: DriverShape;
    piston: DriverPiston;
    active?: string;
}) {
    const { t } = useTranslation('workbench');
    const is = (letter: string) => active === letter;
    const dimmed = (letter: string) => active !== undefined && !is(letter);
    const coneTop = TOP + CONE_IN;
    const coneBottom = BOTTOM - CONE_IN;
    const magnetTop = MID - MAGNET_H / 2;
    const magnetBottom = MID + MAGNET_H / 2;
    // Partes ligadas à letra em foco ficam com preenchimento de destaque.
    const part = (letter: string) =>
        is(letter) ? 'fill-accent/25 stroke-accent' : undefined;

    return (
        <svg
            role="img"
            aria-label={t('dims.drawing')}
            viewBox="0 0 318 170"
            className="h-auto w-full max-w-md self-center text-foreground"
        >
            <g
                fill="none"
                className="stroke-foreground"
                strokeWidth={1.25}
                strokeLinejoin="round"
            >
                {/* Aro (F), cesto, ímã (E) e o pistão (B). */}
                <rect
                    x={RIM_X}
                    y={TOP}
                    width={RIM_W}
                    height={BOTTOM - TOP}
                    className={cn(part('F') ?? part('A'))}
                />
                <path
                    d={`M${BACK} ${coneTop} L${MAGNET_X} ${magnetTop - 4} L${MAGNET_X} ${magnetBottom + 4} L${BACK} ${coneBottom}`}
                />
                <rect
                    x={MAGNET_X}
                    y={magnetTop}
                    width={MAGNET_END - MAGNET_X}
                    height={MAGNET_H}
                    className={part('E') ?? 'fill-raised'}
                />
                <g className={cn(part('B'))}>
                    {piston === 'cone' && (
                        <path
                            d={`M${BACK} ${coneTop} L${BACK + 40} ${MID - 12} L${BACK + 40} ${MID + 12} L${BACK} ${coneBottom}`}
                        />
                    )}
                    {piston === 'dome' && (
                        <path
                            d={`M${BACK} ${coneTop} Q${BACK + 34} ${MID} ${BACK} ${coneBottom}`}
                        />
                    )}
                    {piston === 'flat' && (
                        <path
                            d={`M${BACK + 5} ${coneTop} L${BACK + 5} ${coneBottom}`}
                        />
                    )}
                </g>
                {/* Vista frontal: aro (A), cone (B) e o recorte (C) tracejado entre os dois. */}
                {shape === 'round' ? (
                    <>
                        <circle
                            cx={FRONT_X}
                            cy={MID}
                            r={46}
                            className={cn(part('A'))}
                        />
                        <circle
                            cx={FRONT_X}
                            cy={MID}
                            r={40}
                            strokeDasharray="3 3"
                            className={cn(
                                'stroke-muted',
                                is('C') && 'stroke-accent',
                            )}
                            strokeWidth={is('C') ? 2 : 1}
                        />
                        <circle
                            cx={FRONT_X}
                            cy={MID}
                            r={33}
                            className={cn(part('B'))}
                        />
                        <circle cx={FRONT_X} cy={MID} r={9} />
                    </>
                ) : (
                    <>
                        <rect
                            x={FRONT_X - (shape === 'square' ? 46 : 50)}
                            y={MID - (shape === 'square' ? 46 : 32)}
                            width={shape === 'square' ? 92 : 100}
                            height={shape === 'square' ? 92 : 64}
                            rx={4}
                            className={cn(part('A'))}
                        />
                        <rect
                            x={FRONT_X - (shape === 'square' ? 34 : 38)}
                            y={MID - (shape === 'square' ? 34 : 22)}
                            width={shape === 'square' ? 68 : 76}
                            height={shape === 'square' ? 68 : 44}
                            rx={shape === 'square' ? 34 : 22}
                            className={cn(part('B'))}
                        />
                    </>
                )}
            </g>
            <Dim
                from={{ x: 24, y: TOP }}
                to={{ x: 24, y: BOTTOM }}
                label="A"
                at={{ x: 13, y: MID }}
                active={is('A')}
                dimmed={dimmed('A')}
                extensions={[
                    [
                        { x: RIM_X, y: TOP },
                        { x: 20, y: TOP },
                    ],
                    [
                        { x: RIM_X, y: BOTTOM },
                        { x: 20, y: BOTTOM },
                    ],
                ]}
            />
            <Dim
                from={{ x: 52, y: coneTop - 4 }}
                to={{ x: 52, y: coneBottom + 4 }}
                label="C"
                at={{ x: 41, y: MID }}
                active={is('C')}
                dimmed={dimmed('C')}
            />
            <Dim
                from={{ x: BACK + 22, y: coneTop }}
                to={{ x: BACK + 22, y: coneBottom }}
                label="B"
                at={{ x: BACK + 22, y: BOTTOM + 6 }}
                active={is('B')}
                dimmed={dimmed('B')}
            />
            {/* F é fino: a cota fica acima do aro, com a letra ao lado, sem disputar espaço. */}
            <Dim
                from={{ x: RIM_X, y: 12 }}
                to={{ x: BACK, y: 12 }}
                label="F"
                at={{ x: BACK + 18, y: 12 }}
                anchor="start"
                narrow
                active={is('F')}
                dimmed={dimmed('F')}
                extensions={[
                    [
                        { x: RIM_X, y: TOP },
                        { x: RIM_X, y: 8 },
                    ],
                    [
                        { x: BACK, y: TOP },
                        { x: BACK, y: 8 },
                    ],
                ]}
            />
            <Dim
                from={{ x: MAGNET_X, y: magnetBottom + 14 }}
                to={{ x: MAGNET_END, y: magnetBottom + 14 }}
                label="E"
                at={{ x: (MAGNET_X + MAGNET_END) / 2, y: magnetBottom + 25 }}
                active={is('E')}
                dimmed={dimmed('E')}
                extensions={[
                    [
                        { x: MAGNET_X, y: magnetBottom },
                        { x: MAGNET_X, y: magnetBottom + 18 },
                    ],
                    [
                        { x: MAGNET_END, y: magnetBottom },
                        { x: MAGNET_END, y: magnetBottom + 18 },
                    ],
                ]}
            />
            <Dim
                from={{ x: RIM_X, y: 150 }}
                to={{ x: MAGNET_END, y: 150 }}
                label="G"
                at={{ x: (RIM_X + MAGNET_END) / 2, y: 162 }}
                active={is('G')}
                dimmed={dimmed('G')}
                extensions={[
                    [
                        { x: RIM_X, y: BOTTOM },
                        { x: RIM_X, y: 154 },
                    ],
                    [
                        { x: MAGNET_END, y: magnetBottom },
                        { x: MAGNET_END, y: 154 },
                    ],
                ]}
            />
            {shape === 'rect' && (
                <Dim
                    from={{ x: FRONT_X + 58, y: MID - 32 }}
                    to={{ x: FRONT_X + 58, y: MID + 32 }}
                    label="D"
                    at={{ x: FRONT_X + 66, y: MID }}
                    active={is('D')}
                    dimmed={dimmed('D')}
                />
            )}
        </svg>
    );
}
