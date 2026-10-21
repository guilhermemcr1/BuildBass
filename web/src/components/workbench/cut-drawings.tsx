import { useId } from 'react';
import type { ReactElement } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { Cutout, Piece, Plan } from '@/cutplan';
import { cutoutSummary, pieceName } from '@/lib/cut-plan-text';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// O desenho usa milímetros como unidade de tela; a unidade exibida nas cotas é a do usuário.
const MM = 1000;

type Format = (si: number) => string;

function CutoutShape({
    cutout,
    height,
    size,
    format,
    pendingLabel,
    pendingAt,
}: {
    cutout: Cutout;
    height: number;
    size: number;
    format: Format;
    pendingLabel: string;
    pendingAt: { x: number; r: number };
}) {
    const label = 'fill-foreground';

    if (cutout.center === undefined) {
        // Sem medida ou sem posição: contorno tracejado de referência e o motivo em texto.
        return (
            <g>
                <circle
                    cx={pendingAt.x}
                    cy={height / 2}
                    r={pendingAt.r}
                    className="fill-none stroke-muted"
                    strokeWidth={size * 0.12}
                    strokeDasharray={`${size * 0.5} ${size * 0.4}`}
                />
                <text
                    x={pendingAt.x}
                    y={height / 2 + pendingAt.r + size * 1.4}
                    textAnchor="middle"
                    fontSize={size}
                    className="fill-muted"
                >
                    {pendingLabel}
                </text>
            </g>
        );
    }

    const cx = cutout.center.x_m * MM;
    const cy = height - cutout.center.y_m * MM;
    const fill = 'fill-accent-soft stroke-foreground';
    let shape: ReactElement | undefined;
    let radius = 0;
    let text = '';

    switch (cutout.shape) {
        case 'round': {
            radius = ((cutout.diameter_m ?? 0) * MM) / 2;
            text = `Ø ${format(cutout.diameter_m ?? 0)}`;
            shape = (
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    className={fill}
                    strokeWidth={size * 0.12}
                />
            );
            break;
        }
        case 'rect': {
            const w = (cutout.width_m ?? 0) * MM;
            const h = (cutout.height_m ?? 0) * MM;
            radius = h / 2;
            text = `${format(cutout.width_m ?? 0)} × ${format(cutout.height_m ?? 0)}`;
            shape = (
                <rect
                    x={cx - w / 2}
                    y={cy - h / 2}
                    width={w}
                    height={h}
                    className={fill}
                    strokeWidth={size * 0.12}
                />
            );
            break;
        }
        case 'triangle': {
            const b = (cutout.base_m ?? 0) * MM;
            const h = (cutout.height_m ?? 0) * MM;
            radius = h / 2;
            text = `${format(cutout.base_m ?? 0)} × ${format(cutout.height_m ?? 0)}`;
            shape = (
                <polygon
                    points={`${cx - b / 2},${cy + h / 2} ${cx + b / 2},${cy + h / 2} ${cx},${cy - h / 2}`}
                    className={fill}
                    strokeWidth={size * 0.12}
                />
            );
            break;
        }
    }

    return (
        <g>
            {shape}
            <text
                x={cx}
                y={cy + radius + size * 1.3}
                textAnchor="middle"
                fontSize={size}
                className={label}
            >
                {text}
            </text>
        </g>
    );
}

function PieceDrawing({
    piece,
    scale,
    format,
}: {
    piece: Piece;
    scale: { size: number; pad: number; max: number };
    format: Format;
}) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const titleId = useId();
    const descId = useId();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unit = defaultUnitFor('length', unitSystem);
    const width = piece.w_m * MM;
    const height = piece.h_m * MM;
    const { size, pad } = scale;
    const name = pieceName(piece.role, t);
    const title =
        piece.quantity > 1
            ? `${name} ${t('drawings.quantity', { count: piece.quantity })}`
            : name;
    const cutouts = cutoutSummary(piece.cutouts, {
        t,
        length: (si) => formatWithUnit(si, unit, locale),
    });
    const pending = piece.cutouts.filter(({ center }) => center === undefined);

    return (
        <figure
            className="flex flex-col gap-1"
            style={{ width: `${((width + 2 * pad) / scale.max) * 100}%` }}
        >
            <svg
                role="img"
                aria-labelledby={titleId}
                aria-describedby={descId}
                viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}
                className="h-auto w-full"
            >
                <title id={titleId}>{title}</title>
                <desc id={descId}>
                    {t('drawings.desc', {
                        name,
                        width: format(piece.w_m),
                        height: format(piece.h_m),
                        thickness: format(piece.thickness_m),
                        cutouts:
                            cutouts.length === 0
                                ? t('drawings.noCutouts')
                                : cutouts.join('; '),
                    })}
                </desc>
                <rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    className="fill-raised stroke-foreground"
                    strokeWidth={size * 0.15}
                />
                {piece.cutouts.map((cutout, index) => (
                    <CutoutShape
                        key={`${cutout.kind}-${index}`}
                        cutout={cutout}
                        height={height}
                        size={size}
                        format={format}
                        pendingLabel={t('drawings.pendingLabel')}
                        pendingAt={{
                            x:
                                (width * (pending.indexOf(cutout) + 1)) /
                                (pending.length + 1),
                            r: Math.min(width, height) * 0.1,
                        }}
                    />
                ))}
                <text
                    x={width / 2}
                    y={-size * 0.8}
                    textAnchor="middle"
                    fontSize={size}
                    className="fill-foreground"
                >
                    {format(piece.w_m)}
                </text>
                <text
                    x={-size * 0.8}
                    y={height / 2}
                    textAnchor="middle"
                    fontSize={size}
                    className="fill-foreground"
                    transform={`rotate(-90 ${-size * 0.8} ${height / 2})`}
                >
                    {format(piece.h_m)}
                </text>
            </svg>
            <figcaption className="text-xs text-muted">{title}</figcaption>
        </figure>
    );
}

// Um desenho por peça, todos na mesma escala; as medidas estão na tabela, o desenho só as mostra
// (specs/005, FR-011 e FR-012).
export function CutDrawings({ plan }: { plan: Plan }) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unit = defaultUnitFor('length', unitSystem);
    const format: Format = (si) => formatWithUnit(si, unit, locale);
    const longest = Math.max(
        ...plan.pieces.map((piece) => Math.max(piece.w_m, piece.h_m)),
    );
    const widest = Math.max(...plan.pieces.map((piece) => piece.w_m));
    const size = longest * MM * 0.025;
    const pad = size * 3.2;
    const scale = { size, pad, max: widest * MM + 2 * pad };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start gap-4">
                {plan.pieces.map((piece) => (
                    <PieceDrawing
                        key={piece.role}
                        piece={piece}
                        scale={scale}
                        format={format}
                    />
                ))}
            </div>
            <p className="text-[11px] text-muted">{t('drawings.note')}</p>
        </div>
    );
}
