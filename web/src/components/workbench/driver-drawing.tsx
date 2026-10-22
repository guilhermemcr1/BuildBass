import { useTranslation } from 'react-i18next';
import type { DriverPiston, DriverShape } from '@/lib/project/types';

// Cota: linha com travessões nas pontas e a letra ao lado. Esquema, não escala.
function Dim({
    x1,
    y1,
    x2,
    y2,
    label,
    at,
}: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    label: string;
    at: { x: number; y: number };
}) {
    const vertical = x1 === x2;
    const tick = 3;

    return (
        <g className="stroke-accent" strokeWidth={1}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} />
            {vertical ? (
                <>
                    <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} />
                    <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} />
                </>
            ) : (
                <>
                    <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} />
                    <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} />
                </>
            )}
            <text
                x={at.x}
                y={at.y}
                className="fill-accent-soft stroke-none text-[10px] font-semibold"
                textAnchor="middle"
            >
                {label}
            </text>
        </g>
    );
}

// Corte lateral do alto-falante (aro, cone ou domo, cesto e ímã) com as cotas A–G e, ao lado, a
// vista frontal no formato escolhido.
export function DriverDrawing({
    shape,
    piston,
}: {
    shape: DriverShape;
    piston: DriverPiston;
}) {
    const { t } = useTranslation('workbench');

    return (
        <svg
            role="img"
            aria-label={t('dims.drawing')}
            viewBox="0 0 260 132"
            className="h-auto w-full max-w-72 self-center text-foreground"
        >
            <g
                fill="none"
                className="stroke-foreground"
                strokeWidth={1.25}
                strokeLinejoin="round"
            >
                {/* Aro (F), cesto, ímã (E) e o pistão. */}
                <rect x={56} y={10} width={6} height={86} />
                <path d="M62 22 L106 40 L106 66 L62 84" />
                <rect
                    x={106}
                    y={34}
                    width={36}
                    height={38}
                    className="fill-raised"
                />
                {piston === 'cone' && <path d="M62 22 L96 46 L96 60 L62 84" />}
                {piston === 'dome' && <path d="M62 22 Q86 53 62 84" />}
                {piston === 'flat' && <path d="M66 22 L66 84" />}
                {/* Vista frontal. */}
                {shape === 'round' ? (
                    <>
                        <circle cx={206} cy={53} r={38} />
                        <circle cx={206} cy={53} r={28} />
                        <circle cx={206} cy={53} r={8} />
                    </>
                ) : (
                    <>
                        <rect
                            x={shape === 'square' ? 168 : 162}
                            y={shape === 'square' ? 15 : 25}
                            width={shape === 'square' ? 76 : 88}
                            height={shape === 'square' ? 76 : 56}
                            rx={4}
                        />
                        <rect
                            x={shape === 'square' ? 178 : 172}
                            y={shape === 'square' ? 25 : 33}
                            width={shape === 'square' ? 56 : 68}
                            height={shape === 'square' ? 56 : 40}
                            rx={shape === 'square' ? 28 : 20}
                        />
                    </>
                )}
            </g>
            <Dim
                x1={30}
                y1={10}
                x2={30}
                y2={96}
                label="A"
                at={{ x: 22, y: 56 }}
            />
            <Dim
                x1={44}
                y1={22}
                x2={44}
                y2={84}
                label="C"
                at={{ x: 38, y: 112 }}
            />
            <Dim
                x1={78}
                y1={22}
                x2={78}
                y2={84}
                label="B"
                at={{ x: 78, y: 98 }}
            />
            <Dim
                x1={56}
                y1={108}
                x2={62}
                y2={108}
                label="F"
                at={{ x: 59, y: 119 }}
            />
            <Dim
                x1={106}
                y1={84}
                x2={142}
                y2={84}
                label="E"
                at={{ x: 124, y: 96 }}
            />
            <Dim
                x1={56}
                y1={122}
                x2={142}
                y2={122}
                label="G"
                at={{ x: 99, y: 131 }}
            />
        </svg>
    );
}
