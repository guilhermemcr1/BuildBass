import { deriveDriver } from './driver';
import { portArea, portLength } from './port';
import type { BoxType, DriverKey, ProjectInput } from './types';

export type Alignment = 'butterworth2' | 'keele';

export type Suggestion =
    | {
          ok: true;
          // Volume bruto: o do alinhamento mais drivers e dutos.
          vb_m3: number;
          fb_hz?: number;
          alignment: Alignment;
          qtc?: number;
      }
    | {
          ok: false;
          reason: 'qtsTooHigh' | 'qtsTooLow';
          recommend?: BoxType;
      }
    | { ok: false; reason: 'missing'; missing: DriverKey[] };

const NEEDS: DriverKey[] = ['fs_hz', 'qts', 'vas_m3'];
const BUTTERWORTH_QTC = 0.707;
// Acima disso α < 0,3: a caixa passaria de 3,3·Vas (research.md §10).
const CLOSED_MAX_QTS = 0.62;
// Faixa das aproximações de Keele.
const VENTED_MIN_QTS = 0.2;
const VENTED_MAX_QTS = 0.5;

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

    // Aproximações de Keele dos alinhamentos de Thiele com QL ≈ 7 ([K73], em [D06]).
    const net = count * 15 * qts ** 2.87 * vas;
    const fb = 0.42 * fs * qts ** -0.9;
    const area = portArea(project.box.port);
    const ports = Math.max(1, Math.round(project.box.port.count));

    // Com a medida do duto, soma o volume que ele ocupa (research.md §7).
    const portVolume =
        area === undefined
            ? 0
            : Math.max(
                  0,
                  ports *
                      area *
                      portLength({
                          fb_hz: fb,
                          volume_m3: net,
                          area_m2: area,
                          count: ports,
                      }),
              );

    return {
        ok: true,
        vb_m3: net + drivers + portVolume,
        fb_hz: fb,
        alignment: 'keele',
    };
}
