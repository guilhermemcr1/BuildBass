import { SPEED_OF_SOUND } from './constants';
import type { PortEnd, PortInput } from './types';

// Área de um duto por formato (data-model.md); undefined se faltar medida.
export function portArea(port: PortInput): number | undefined {
    switch (port.shape) {
        case 'round':
            return port.diameter_m === undefined
                ? undefined
                : (Math.PI * port.diameter_m ** 2) / 4;
        case 'rect':
            return port.width_m === undefined || port.height_m === undefined
                ? undefined
                : port.width_m * port.height_m;
        case 'triangle':
            return port.base_m === undefined || port.height_m === undefined
                ? undefined
                : (port.base_m * port.height_m) / 2;
    }
}

// Correção de ponta somando as duas pontas, em múltiplos do raio do círculo de mesma área. Ponta
// flangeada 0,85·r e livre 0,613·r ([B54] cap. 5): flangeada + livre = 1,463·r, o k = 0,732·d de
// [D06] e o padrão do WinISD, do Hornresp e das calculadoras online; duas livres 1,226·r; duas
// flangeadas 1,70·r. Slot encostado na parede: 2,2·r, calibrado pelo boletim do JL 10W6v3 (slot
// 35 × 276 mm, 21,2 L, 39 Hz, 772 mm → 2,20·r) e pela saída do subbox.pro (150 cm² → 2,15·r); a
// parede prolonga o duto como um flange de cada lado da fenda.
export const END_FACTORS: Record<Exclude<PortEnd, 'custom'>, number> = {
    flangedFree: 1.463,
    free: 1.226,
    flanged: 1.7,
    slotWall: 2.2,
};

export const DEFAULT_END_FACTOR = END_FACTORS.flangedFree;

// Fator da correção de ponta escolhida no duto; `custom` sem número cai no padrão.
export function endFactor(port?: PortInput): number {
    const end = port?.end ?? 'flangedFree';

    if (end === 'custom') {
        return port?.end_k ?? DEFAULT_END_FACTOR;
    }

    return END_FACTORS[end];
}

export function endCorrection(
    area: number,
    factor = DEFAULT_END_FACTOR,
): number {
    return factor * Math.sqrt(area / Math.PI);
}

type LengthInput = {
    fb_hz: number;
    volume_m3: number;
    area_m2: number;
    count: number;
    end_factor?: number;
};

// Comprimento físico para sintonizar em Fb: Lv = c²·Sp / (4π²·Fb²·Vb) − Δ, com Sp = n·Sp1
// (research.md §7, [D06]).
export function portLength({
    fb_hz,
    volume_m3,
    area_m2,
    count,
    end_factor,
}: LengthInput): number {
    const total = count * area_m2;

    return (
        (SPEED_OF_SOUND ** 2 * total) /
            (4 * Math.PI ** 2 * fb_hz ** 2 * volume_m3) -
        endCorrection(area_m2, end_factor)
    );
}

type NetInput = {
    vb_m3: number;
    drivers_m3: number;
    fb_hz: number;
    area_m2: number;
    count: number;
    end_factor?: number;
};

export type NetVolume = {
    // ≤ 0 quando drivers e dutos não cabem na caixa.
    net_m3: number;
    port_m3: number;
    length_m: number;
};

// Volume líquido = Vb − drivers − dutos, e o comprimento do duto depende do volume líquido.
// Com Lv = C/net − Δ (C = c²·n·a / (4π²·Fb²)) e volume dos dutos n·a·Lv, o volume líquido é a
// maior raiz de net² − (A + n·a·Δ)·net + n·a·C = 0, com A = Vb − drivers (research.md §7).
export function netVolume({
    vb_m3,
    drivers_m3,
    fb_hz,
    area_m2,
    count,
    end_factor,
}: NetInput): NetVolume {
    const available = vb_m3 - drivers_m3;
    const portArea = count * area_m2;
    const delta = endCorrection(area_m2, end_factor);
    const c =
        (SPEED_OF_SOUND ** 2 * portArea) / (4 * Math.PI ** 2 * fb_hz ** 2);

    if (available <= 0) {
        return { net_m3: available, port_m3: 0, length_m: Number.NaN };
    }

    // Duto mais curto que a correção de ponta: não ocupa volume (e o motor avisa).
    if (c / available - delta <= 0) {
        return {
            net_m3: available,
            port_m3: 0,
            length_m: c / available - delta,
        };
    }

    const b = available + portArea * delta;
    const discriminant = b ** 2 - 4 * portArea * c;

    if (discriminant < 0) {
        return { net_m3: 0, port_m3: available, length_m: Number.NaN };
    }

    const net = (b + Math.sqrt(discriminant)) / 2;
    const length = c / net - delta;

    return { net_m3: net, port_m3: portArea * length, length_m: length };
}

// 1ª ressonância de tubo do duto, aberto nas duas pontas: meia onda no comprimento efetivo,
// f = c / (2·(L + Δ)). Ela vaza pelo duto como um pico estreito.
export function pipeResonance(
    length_m: number,
    area_m2: number,
    end_factor?: number,
): number {
    return (
        SPEED_OF_SOUND / (2 * (length_m + endCorrection(area_m2, end_factor)))
    );
}
