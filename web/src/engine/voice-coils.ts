import type { DriverInput, ProjectInput } from './types';

// Bobina dupla (DVC). Os parâmetros da ficha são das duas bobinas em série (é como os fabricantes
// medem: Re ≈ 2× a impedância de uma bobina). Ligadas em paralelo, a mesma bobina vista dos
// terminais tem 1/4 da resistência e da indutância e metade do BL; Fs, Qms, Qes, Qts, Vas, Sd e Mms
// não mudam (Qes ∝ Re/BL² fica igual). Muda a carga no amplificador e a sensibilidade por volt.
export function withVoiceCoils(project: ProjectInput): ProjectInput {
    const { drivers, driver } = project;

    if ((drivers.voice_coils ?? 1) < 2 || drivers.coil_wiring !== 'parallel') {
        return project;
    }

    const scaled: DriverInput = { ...driver };
    const factors = {
        re_ohm: 1 / 4,
        le_h: 1 / 4,
        le10k_h: 1 / 4,
        bl_tm: 1 / 2,
    };

    for (const [key, factor] of Object.entries(factors)) {
        const value = driver[key as keyof DriverInput];

        if (value !== undefined) {
            scaled[key as keyof DriverInput] = value * factor;
        }
    }

    return { ...project, driver: scaled };
}
