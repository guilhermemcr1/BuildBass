import { SPEED_OF_SOUND } from './constants';
import { deriveDriver } from './driver';
import { endFactor, portArea, portLength } from './port';
import type { BoxType, DriverKey, ProjectInput } from './types';

// Dutada: a família de Thiele (QB3 abaixo da B4, B4, C4 acima) calculada para o QL da caixa.
export type Alignment = 'butterworth2' | 'qb3' | 'b4' | 'c4';

export type Suggestion =
    | {
          ok: true;
          // Volume bruto: o do alinhamento mais drivers e dutos.
          vb_m3: number;
          fb_hz?: number;
          alignment: Alignment;
          qtc?: number;
          // Dutada: o QL usado e a aproximação de Keele para o mesmo driver, só como referência.
          ql?: number;
          keele?: { vb_m3: number; fb_hz: number };
      }
    | {
          ok: false;
          reason: 'qtsTooHigh' | 'qtsTooLow';
          recommend?: BoxType;
      }
    | { ok: false; reason: 'missing'; missing: DriverKey[] }
    | {
          ok: false;
          reason: 'portTooLarge';
          fb_hz: number;
          // Área total dos dutos informada e a maior que ainda serve ao alinhamento.
          port_area_m2: number;
          max_port_area_m2: number;
      };

const NEEDS: DriverKey[] = ['fs_hz', 'qts', 'vas_m3'];
const BUTTERWORTH_QTC = 0.707;
// Acima disso α < 0,3: a caixa passaria de 3,3·Vas (research.md §10).
const CLOSED_MAX_QTS = 0.62;
const VENTED_MIN_QTS = 0.2;
const VENTED_MAX_QTS = 0.5;
// C4 com ondulação acima disso já não é um alinhamento de tabela: a sugestão recusa.
const MAX_RIPPLE_DB = 1;
// |D| abaixo disso é a própria B4 (os três coeficientes nulos).
const B4_BAND = 0.05;

type Coefficients = { a1: number; a2: number; a3: number };

// Polinômio da dutada com vazamento, [S73v] eq. 13–16 (QA = QP = ∞):
// G(s) = s⁴T0⁴ / (s⁴T0⁴ + a1·s³T0³ + a2·s²T0² + a3·sT0 + 1), h = Fb/Fs, α = Vas/Vb.
function coefficients(
    alpha: number,
    h: number,
    qt: number,
    ql: number,
): Coefficients {
    const root = Math.sqrt(h);

    return {
        a1: (ql + h * qt) / (root * ql * qt),
        a2: (h + (alpha + 1 + h ** 2) * ql * qt) / (h * ql * qt),
        a3: (h * ql + qt) / (root * ql * qt),
    };
}

// |G|² = x⁸ / (x⁸ + B·x⁶ + C·x⁴ + D·x² + 1). A família plana de Thiele zera B e C; D > 0 é QB3,
// D = 0 a B4 e D < 0 a C4 (com ondulação). B = 0 dá α em função de h; C(h) = 0 se resolve por
// varredura e bisseção. Com QL 7 e Qts 0,4048 cai em α 1,061 e h 1,000, a linha B4 publicada.
function flatAlignment(qt: number, ql: number) {
    const loss = Math.min(ql, 1e9);
    const alphaAt = (h: number) => {
        const { a1 } = coefficients(1, h, qt, loss);

        return ((a1 ** 2 / 2) * h * loss * qt - h) / (loss * qt) - 1 - h ** 2;
    };
    const cAt = (h: number) => {
        const alpha = alphaAt(h);

        if (alpha <= 0) {
            return Number.NaN;
        }

        const { a1, a2, a3 } = coefficients(alpha, h, qt, loss);

        return a2 ** 2 + 2 - 2 * a1 * a3;
    };

    const steps = 600;
    let previous = { h: 0.3, c: cAt(0.3) };

    for (let index = 1; index <= steps; index++) {
        const h = 0.3 + (3.2 * index) / steps;
        const c = cAt(h);

        if (
            Number.isFinite(c) &&
            Number.isFinite(previous.c) &&
            Math.sign(c) !== Math.sign(previous.c)
        ) {
            let low = previous.h;
            let high = h;

            for (let step = 0; step < 60; step++) {
                const middle = (low + high) / 2;

                if (Math.sign(cAt(middle)) === Math.sign(cAt(low))) {
                    low = middle;
                } else {
                    high = middle;
                }
            }

            const root = (low + high) / 2;
            const alpha = alphaAt(root);
            const { a1, a2, a3 } = coefficients(alpha, root, qt, loss);

            return {
                alpha,
                h: root,
                d: a3 ** 2 - 2 * a2,
                peak_db: peakDb({ a1, a2, a3 }, root),
            };
        }

        previous = { h, c };
    }

    return undefined;
}

// Maior ganho da resposta (dB), varrendo duas décadas para cada lado da sintonia.
function peakDb({ a1, a2, a3 }: Coefficients, h: number): number {
    let peak = Number.NEGATIVE_INFINITY;

    for (let index = 0; index <= 800; index++) {
        const w = 10 ** (-2 + (4 * index) / 800) / Math.sqrt(h);
        const re = w ** 4 - a2 * w ** 2 + 1;
        const im = a3 * w - a1 * w ** 3;

        peak = Math.max(peak, 20 * Math.log10(w ** 4 / Math.hypot(re, im)));
    }

    return peak;
}

// Sugestão de caixa pelos alinhamentos clássicos (research.md §10, FR-019).
export function suggestBox(project: ProjectInput): Suggestion {
    const { values } = deriveDriver(project.driver);
    const missing = NEEDS.filter((key) => values[key].value === undefined);

    if (missing.length > 0) {
        return { ok: false, reason: 'missing', missing };
    }

    const fs = values.fs_hz.value as number;
    const qts = values.qts.value as number;
    const vas = values.vas_m3.value as number;
    const count = Math.max(1, Math.round(project.drivers.count));
    const drivers = count * (values.vd_m3.value ?? 0);

    if (project.box.type === 'closed') {
        if (qts > CLOSED_MAX_QTS) {
            return { ok: false, reason: 'qtsTooHigh' };
        }

        // Qtc = Qts·√(1 + α) com α = Vas/Vb ([S73c] eq. 9): Vb = Vas / ((Qtc/Qts)² − 1).
        const net = vas / ((BUTTERWORTH_QTC / qts) ** 2 - 1);

        return {
            ok: true,
            vb_m3: count * net + drivers,
            alignment: 'butterworth2',
            qtc: BUTTERWORTH_QTC,
        };
    }

    if (qts > VENTED_MAX_QTS) {
        return { ok: false, reason: 'qtsTooHigh', recommend: 'closed' };
    }

    if (qts < VENTED_MIN_QTS) {
        return { ok: false, reason: 'qtsTooLow' };
    }

    const ql = project.box.ql;
    const flat = flatAlignment(qts, ql);

    if (flat === undefined || flat.peak_db > MAX_RIPPLE_DB) {
        return { ok: false, reason: 'qtsTooHigh', recommend: 'closed' };
    }

    const net = (count * vas) / flat.alpha;
    const fb = flat.h * fs;
    const area = portArea(project.box.port);
    const ports = Math.max(1, Math.round(project.box.port.count));
    const factor = endFactor(project.box.port);

    // Com Vb fixo há dois pares (volume líquido, comprimento do duto) com a mesma sintonia, e o
    // produto dos dois volumes vale (n·a)²·c² / (4π²·Fb²) (port.ts, netVolume). A simulação fica com
    // o maior; o do alinhamento só é ele enquanto n·a ≤ 2π·Fb·V_líq / c. Acima disso o duto ocuparia
    // mais que o ar da caixa e o Vb sugerido simularia outra caixa.
    const maxArea = (2 * Math.PI * fb * net) / SPEED_OF_SOUND;

    if (area !== undefined && ports * area > maxArea) {
        return {
            ok: false,
            reason: 'portTooLarge',
            fb_hz: fb,
            port_area_m2: ports * area,
            max_port_area_m2: maxArea,
        };
    }

    // Volume bruto: o líquido mais drivers e, com a medida do duto, o volume que ele ocupa
    // (research.md §7).
    const gross = (volume: number, tuning: number) =>
        volume +
        drivers +
        (area === undefined
            ? 0
            : Math.max(
                  0,
                  ports *
                      area *
                      portLength({
                          fb_hz: tuning,
                          volume_m3: volume,
                          area_m2: area,
                          count: ports,
                          end_factor: factor,
                      }),
              ));

    // Aproximações de Keele dos alinhamentos de Thiele com QL ≈ 7 ([K73], em [D06]), mostradas
    // ao lado para quem compara com calculadoras que as usam.
    const keeleNet = count * 15 * qts ** 2.87 * vas;
    const keeleFb = 0.42 * fs * qts ** -0.9;

    return {
        ok: true,
        vb_m3: gross(net, fb),
        fb_hz: fb,
        alignment:
            Math.abs(flat.d) <= B4_BAND ? 'b4' : flat.d > 0 ? 'qb3' : 'c4',
        ql,
        keele: { vb_m3: gross(keeleNet, keeleFb), fb_hz: keeleFb },
    };
}
