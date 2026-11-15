import type { TFunction } from 'i18next';
import type { Cutout, CutoutRef, PieceRole, PlanKey } from '@/cutplan';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';

// Textos do plano de corte compartilhados pela tela, pela impressão e pelo CSV. Não conhecem React.

export type PlanText = {
    t: TFunction;
    // Comprimento em SI → texto na unidade e na locale ativas, com a unidade ("285,0 mm").
    length: (meters: number) => string;
};

export function pieceName(role: PieceRole, t: TFunction): string {
    return t(`cutplan:parts.names.${role}`);
}

export function piecePosition(role: PieceRole, t: TFunction): string {
    return t(`cutplan:parts.positions.${role}`);
}

// Símbolo do campo na bancada (Vb, t, Ød…); "ratio" é a proporção inteira.
export function planKeySymbol(key: PlanKey, t: TFunction): string {
    if (key === 'ratio') {
        return t('cutplan:keys.ratio');
    }

    return PARAMETERS[key as ParameterKey]?.symbol ?? key;
}

function sizeOf(cutout: Cutout, { t, length }: PlanText): string | undefined {
    switch (cutout.shape) {
        case 'round':
            return cutout.diameter_m === undefined
                ? undefined
                : t('cutplan:cutouts.round', {
                      size: length(cutout.diameter_m),
                  });
        case 'rect':
            return cutout.width_m === undefined || cutout.height_m === undefined
                ? undefined
                : t('cutplan:cutouts.rect', {
                      width: length(cutout.width_m),
                      height: length(cutout.height_m),
                  });
        case 'triangle':
            return cutout.base_m === undefined || cutout.height_m === undefined
                ? undefined
                : t('cutplan:cutouts.triangle', {
                      base: length(cutout.base_m),
                      height: length(cutout.height_m),
                  });
    }
}

// "Driver 1", "Duto 2": o recorte pela identidade (specs/012).
export function cutoutName(ref: CutoutRef, t: TFunction): string {
    return t(`cutplan:cutouts.ref_${ref.kind}`, { n: ref.n });
}

// "Driver Ø 285,0 mm" ou, sem medida, "Driver: diâmetro a informar".
export function describeCutout(cutout: Cutout, text: PlanText): string {
    const { t } = text;
    const name = t(`cutplan:cutouts.${cutout.kind}`);
    const size = sizeOf(cutout, text);

    if (size !== undefined) {
        return `${name} ${size}`;
    }

    return `${name}: ${t(
        cutout.kind === 'driver'
            ? 'cutplan:cutouts.driverPending'
            : 'cutplan:cutouts.portPending',
    )}`;
}

// Recortes iguais viram um item com a quantidade ("Driver ×2 Ø 285,0 mm").
export function cutoutSummary(cutouts: Cutout[], text: PlanText): string[] {
    const groups = new Map<string, { cutout: Cutout; count: number }>();

    for (const cutout of cutouts) {
        // Posição e identidade (specs/012) não diferenciam recortes iguais.
        const {
            center: _center,
            ref: _ref,
            manual: _manual,
            ...shape
        } = cutout;
        const key = JSON.stringify(shape);
        const group = groups.get(key);

        if (group === undefined) {
            groups.set(key, { cutout, count: 1 });
        } else {
            group.count += 1;
        }
    }

    return [...groups.values()].map(({ cutout, count }) => {
        const line = describeCutout(cutout, text);

        return count === 1
            ? line
            : `${line} ${text.t('cutplan:cutouts.count', { count })}`;
    });
}
