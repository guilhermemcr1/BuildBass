import { SPEED_OF_SOUND } from './constants';
import type { PortInput } from './types';

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

// Correção de ponta com o raio do círculo de mesma área: uma ponta flangeada (0,85·r) e uma
// livre (0,613·r) somam 1,463·r ([B54] cap. 5; é o k = 0,732·d de [D06]).
export function endCorrection(area: number): number {
    return 1.463 * Math.sqrt(area / Math.PI);
}

type LengthInput = {
    fb_hz: number;
    volume_m3: number;
    area_m2: number;
    count: number;
};

// Comprimento físico para sintonizar em Fb: Lv = c²·Sp / (4π²·Fb²·Vb) − Δ, com Sp = n·Sp1
// (research.md §7, [D06]).
export function portLength({
    fb_hz,
    volume_m3,
    area_m2,
    count,
}: LengthInput): number {
    const total = count * area_m2;

    return (
        (SPEED_OF_SOUND ** 2 * total) /
            (4 * Math.PI ** 2 * fb_hz ** 2 * volume_m3) -
        endCorrection(area_m2)
    );
}

type NetInput = {
    vb_m3: number;
    drivers_m3: number;
    fb_hz: number;
    area_m2: number;
    count: number;
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
}: NetInput): NetVolume {
    const available = vb_m3 - drivers_m3;
    const portArea = count * area_m2;
    const delta = endCorrection(area_m2);
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
