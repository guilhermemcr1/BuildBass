// Onde pôr o cartão do tutorial em relação ao elemento destacado. Função pura, em pixels da tela.

export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Side = 'right' | 'bottom' | 'left' | 'top';

export type CardPosition = {
    left: number;
    top: number;
    // `inside`: nenhum lado coube, então o cartão fica sobre o próprio elemento, num canto.
    placement: Side | 'inside' | 'center';
};

const GAP = 16;
const MARGIN = 12;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), Math.max(min, max));
}

export function placeCard(
    target: Rect | null,
    card: Size,
    view: Size,
    order: Side[] = ['right', 'bottom', 'left', 'top'],
): CardPosition {
    const centerX = (view.width - card.width) / 2;
    const centerY = (view.height - card.height) / 2;

    if (target === null) {
        return { left: centerX, top: centerY, placement: 'center' };
    }

    // Visto que o alvo pode ser mais alto que a tela, o centro vertical vale só na parte visível.
    const maxLeft = view.width - card.width - MARGIN;
    const maxTop = view.height - card.height - MARGIN;
    const alongX = clamp(
        target.left + (target.width - card.width) / 2,
        MARGIN,
        maxLeft,
    );
    const alongY = clamp(
        target.top + (target.height - card.height) / 2,
        MARGIN,
        maxTop,
    );
    const right = target.left + target.width;
    const bottom = target.top + target.height;
    const spots: Record<Side, { left: number; top: number; fits: boolean }> = {
        right: {
            left: right + GAP,
            top: alongY,
            fits: right + GAP + card.width <= view.width - MARGIN,
        },
        left: {
            left: target.left - GAP - card.width,
            top: alongY,
            fits: target.left - GAP - card.width >= MARGIN,
        },
        bottom: {
            left: alongX,
            top: bottom + GAP,
            fits: bottom + GAP + card.height <= view.height - MARGIN,
        },
        top: {
            left: alongX,
            top: target.top - GAP - card.height,
            fits: target.top - GAP - card.height >= MARGIN,
        },
    };

    for (const side of order) {
        const spot = spots[side];

        if (spot.fits) {
            return { left: spot.left, top: spot.top, placement: side };
        }
    }

    return {
        left: clamp(right - card.width - GAP, MARGIN, maxLeft),
        top: clamp(bottom - card.height - GAP, MARGIN, maxTop),
        placement: 'inside',
    };
}
