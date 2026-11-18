import type { ProjectInput } from '@/engine';
import { voiceCoils } from '@/lib/impedance';
import type { ProjectData } from './types';

// Projeto → entrada do motor. O número de bobinas não fica gravado: vem da variação ("4+4 Ω" é
// bobina dupla), que é a única fonte; a ligação das bobinas (`drivers.coil_wiring`) é escolha do
// projeto.
export function engineInput(data: ProjectData): ProjectInput {
    const coils = voiceCoils(data.driverSource?.variant);

    if (coils === 1) {
        return data;
    }

    return { ...data, drivers: { ...data.drivers, voice_coils: coils } };
}
