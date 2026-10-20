import { add, complex, div, inv, mul, scale } from './complex';
import type { Complex } from './complex';

// Circuito equivalente de um driver numa caixa, resolvido por frequência ([L10] cap. 4–5;
// [S73v] fig. 2). Um só modelo serve à selada (sem duto) e à dutada.
//
//   elétrico:  V = Ze·i + Bl·u,                Ze = Re + jωLe
//   mecânico:  Bl·i = (Zm + Sd²·Zb)·u,         Zm = Rms + jωMms + 1/(jωCms)
//   caixa:     Zb = 1 / (jωCab + 1/Ral + 1/(jωMap))   (impedância acústica vista pela traseira)
//
// u é a velocidade do cone (para fora), Ud = Sd·u. A pressão na caixa é pb = −Zb·Ud, e o volume
// que sai pelo duto e pelo vazamento faz o total radiado valer U0 = jω·Cab·Zb·Ud.
export type CircuitParams = {
    re: number;
    le: number;
    bl: number;
    mms: number;
    cms: number;
    rms: number;
    sd: number;
    // Compliância acústica da caixa por driver: Cab = Vb_líq / (ρ·c²).
    cab: number;
    // Resistência de vazamento; Infinity = caixa sem perdas.
    ral: number;
    // Massa acústica do duto; undefined = caixa selada.
    map?: number;
};

export type CircuitPoint = {
    // Velocidade do cone por volt aplicado, m/s/V.
    velocity: Complex;
    // Volume total radiado (cone + duto + vazamento) por volt, m³/s/V.
    radiated: Complex;
    // Volume que sai pelo duto por volt, m³/s/V (zero na selada).
    port: Complex;
    // Impedância elétrica nos terminais de um driver, Ω.
    impedance: Complex;
};

export function solveCircuit(
    params: CircuitParams,
    frequency: number,
): CircuitPoint {
    const omega = 2 * Math.PI * frequency;
    const jw = complex(0, omega);

    const ze = complex(params.re, omega * params.le);
    const zm = add(
        complex(params.rms, omega * params.mms),
        inv(scale(jw, params.cms)),
    );

    let boxAdmittance = add(scale(jw, params.cab), complex(1 / params.ral));

    if (params.map !== undefined) {
        boxAdmittance = add(boxAdmittance, inv(scale(jw, params.map)));
    }

    const zb = inv(boxAdmittance);
    const motional = add(zm, scale(zb, params.sd ** 2));
    const damping = div(complex(params.bl ** 2), ze);

    const velocity = div(div(complex(params.bl), ze), add(motional, damping));
    const coneVolume = scale(velocity, params.sd);
    const boxPressure = scale(mul(zb, coneVolume), -1);
    const port =
        params.map === undefined
            ? complex(0)
            : div(boxPressure, scale(jw, params.map));
    const radiated = mul(scale(mul(jw, zb), params.cab), coneVolume);
    const impedance = add(ze, div(complex(params.bl ** 2), motional));

    return { velocity, radiated, port, impedance };
}
