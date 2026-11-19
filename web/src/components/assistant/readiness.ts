import { RESPONSE_NEEDS, deriveDriver } from '@/engine';
import type { DriverKey } from '@/engine';
import { simulationOf } from '@/hooks/use-simulation';
import type { ProjectData } from '@/lib/project/types';

// O mínimo do alto-falante para o assistente seguir: o mesmo que o motor pede para a resposta.
export const DRIVER_MINIMUM: DriverKey[] = RESPONSE_NEEDS;

// Fs, Qts e Vas presentes, digitados ou calculados dos outros parâmetros.
export function driverReady(data: ProjectData): boolean {
    const { values } = deriveDriver(data.driver);

    return DRIVER_MINIMUM.every((key) => values[key].value !== undefined);
}

// A caixa tem o que o motor precisa para desenhar a resposta (volume e, na dutada, a sintonia).
export function boxReady(data: ProjectData): boolean {
    return driverReady(data) && simulationOf(data).missing.spl_db.length === 0;
}
