import { PORT_VELOCITY_ERROR_MS } from '@/engine';
import type { EngineWarning, PortInput } from '@/engine';
import { simulationOf } from '@/hooks/use-simulation';
import type { ProjectData } from '@/lib/project/types';
import type { AiCandidate } from './client';

// Avisos do motor que tornam a caixa inviável: o duto não cabe ou não sobra volume.
const BLOCKING: EngineWarning['id'][] = [
    'netVolumeInvalid',
    'portVolumeTooLarge',
];

export type CandidateCheck = {
    data: ProjectData;
    usable: boolean;
    f3_hz?: number;
    net_m3?: number;
    port_length_m?: number;
    velocity_ms?: number;
    // Velocidade no duto acima do limite de ruído, com a potência do projeto.
    loud: boolean;
    warnings: EngineWarning['id'][];
};

// O projeto com a caixa do candidato: tipo, Vb, Fb e duto. A trava do duto volta para a Fb (o
// comprimento sai da sintonia), e o resto do projeto (alto-falante, sinal, perdas) fica.
export function applyCandidate(
    data: ProjectData,
    candidate: AiCandidate,
): ProjectData {
    const box = { ...data.box, type: candidate.type, vb_m3: candidate.vb_m3 };

    if (candidate.type === 'closed' || candidate.port === null) {
        return { ...data, box };
    }

    const { length_m: _length, ...current } = data.box.port;
    const port: PortInput =
        candidate.port.shape === 'round'
            ? {
                  ...current,
                  shape: 'round',
                  diameter_m: candidate.port.diameter_m,
                  count: candidate.port.count,
              }
            : {
                  ...current,
                  shape: 'rect',
                  width_m: candidate.port.width_m,
                  height_m: candidate.port.height_m,
                  count: candidate.port.count,
              };

    return {
        ...data,
        box: { ...box, fb_hz: candidate.fb_hz ?? data.box.fb_hz, port },
    };
}

// Simula o candidato no motor do app: o que a IA propõe só é mostrado com os números do motor.
export function checkCandidate(
    data: ProjectData,
    candidate: AiCandidate,
): CandidateCheck {
    const next = applyCandidate(data, candidate);
    const { results, warnings } = simulationOf(next);
    const ids = warnings.map((warning) => warning.id);
    const velocity = results.port_velocity_max_ms;

    return {
        data: next,
        usable: !ids.some((id) => BLOCKING.includes(id)),
        f3_hz: results.f3_hz,
        net_m3: results.net_volume_m3,
        port_length_m: results.port_length_m,
        velocity_ms: velocity,
        loud: velocity !== undefined && velocity > PORT_VELOCITY_ERROR_MS,
        warnings: ids,
    };
}
