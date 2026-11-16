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
//
// Bandpass de 4ª ordem (feature 004; [L10] cap. 4–5, topologia de [G89] e [D06]): a câmara
// traseira selada, Zr = 1 / (jωCr + 1/Ralr), fica em série com a câmara frontal dutada, Zb, e o
// cone vê as duas como carga:
//   mecânico:  Bl·i = (Zm + Sd²·(Zb + Zr))·u
//   frontal:   pf = Zb·Ud,  Up = pf / (jω·Map)   (a única saída acústica é o duto)
//
// Bandpass de 6ª ordem (feature 007, research.md §1): a câmara traseira também leva um duto,
// Zr = 1 / (jωCr + 1/Ralr + 1/(jω·Mapr)), aberto para fora da caixa. O cone rarefaz a câmara
// traseira quando comprime a frontal, então o ar entra pelo duto traseiro:
//   traseira:  pr = −Zr·Ud,  Upr = pr / (jω·Mapr)   (negativo: fluxo para dentro)
//   saída:     U0 = Up + Upr   (os dois dutos irradiam para fora, como uma fonte pontual a 1 m)
//
// Absorção (material na caixa, [S73v] QA): Rab em série com a compliância de cada câmara, então o
// ramo da compliância vira Yc = 1 / (Rab + 1/(jωCab)), e o total radiado da caixa com duto é o que
// entra nesse ramo, U0 = Yc·Zb·Ud. Bobina com perdas ([Leach 2002]): Ze = Re + K·(jω)^n no lugar
// de Re + jωLe.
export type CircuitParams = {
    re: number;
    le: number;
    // Bobina com perdas de Leach; quando presente, `le` não é usado.
    leach?: { k: number; n: number };
    bl: number;
    mms: number;
    cms: number;
    rms: number;
    sd: number;
    // Compliância acústica da caixa por driver: Cab = Vb_líq / (ρ·c²).
    cab: number;
    // Resistência de vazamento; Infinity = caixa sem perdas.
    ral: number;
    // Resistência de absorção em série com a compliância; ausente ou 0 = sem material.
    rab?: number;
    // Massa acústica do duto; undefined = caixa selada.
    map?: number;
    // Câmara traseira da bandpass (`cab`, `ral` e `map` passam a ser os da câmara frontal);
    // undefined = selada ou dutada como na feature 002. Com `map` a traseira é dutada (6ª ordem).
    rear?: { cab: number; ral: number; map?: number; rab?: number };
};

export type CircuitPoint = {
    // Velocidade do cone por volt aplicado, m/s/V.
    velocity: Complex;
    // Volume total radiado (cone + duto + vazamento) por volt, m³/s/V. Na bandpass, só o duto.
    radiated: Complex;
    // Volume que sai pelo duto por volt, m³/s/V (zero na selada). Na bandpass, o duto frontal.
    port: Complex;
    // Bandpass de 6ª ordem: volume que sai pelo duto traseiro por volt (negativo = entra); zero sem
    // duto traseiro.
    rearPort: Complex;
    // Impedância elétrica nos terminais de um driver, Ω.
    impedance: Complex;
};

export function solveCircuit(
    params: CircuitParams,
    frequency: number,
): CircuitPoint {
    const omega = 2 * Math.PI * frequency;
    const jw = complex(0, omega);

    const ze =
        params.leach === undefined
            ? complex(params.re, omega * params.le)
            : add(
                  complex(params.re),
                  scale(
                      complex(
                          Math.cos((params.leach.n * Math.PI) / 2),
                          Math.sin((params.leach.n * Math.PI) / 2),
                      ),
                      params.leach.k * omega ** params.leach.n,
                  ),
              );
    const zm = add(
        complex(params.rms, omega * params.mms),
        inv(scale(jw, params.cms)),
    );

    // Ramo da compliância de uma câmara, com a absorção em série quando há material.
    const compliance = (cab: number, rab?: number) =>
        rab === undefined || rab <= 0
            ? scale(jw, cab)
            : inv(add(complex(rab), inv(scale(jw, cab))));
    const boxCompliance = compliance(params.cab, params.rab);
    let boxAdmittance = add(boxCompliance, complex(1 / params.ral));

    if (params.map !== undefined) {
        boxAdmittance = add(boxAdmittance, inv(scale(jw, params.map)));
    }

    const zb = inv(boxAdmittance);
    let rearAdmittance =
        params.rear === undefined
            ? complex(0)
            : add(
                  compliance(params.rear.cab, params.rear.rab),
                  complex(1 / params.rear.ral),
              );

    if (params.rear?.map !== undefined) {
        rearAdmittance = add(rearAdmittance, inv(scale(jw, params.rear.map)));
    }

    const zrear = params.rear === undefined ? complex(0) : inv(rearAdmittance);
    const motional = add(zm, scale(add(zb, zrear), params.sd ** 2));
    const damping = div(complex(params.bl ** 2), ze);

    const velocity = div(div(complex(params.bl), ze), add(motional, damping));
    const coneVolume = scale(velocity, params.sd);
    const boxPressure = scale(mul(zb, coneVolume), -1);

    // Bandpass: pressão física na câmara frontal, pf = +Zb·Ud (o cone a comprime).
    if (params.rear !== undefined && params.map !== undefined) {
        const port = div(mul(zb, coneVolume), scale(jw, params.map));
        const rearPort =
            params.rear.map === undefined
                ? complex(0)
                : div(
                      scale(mul(zrear, coneVolume), -1),
                      scale(jw, params.rear.map),
                  );

        return {
            velocity,
            radiated: add(port, rearPort),
            port,
            rearPort,
            impedance: add(ze, div(complex(params.bl ** 2), motional)),
        };
    }

    const port =
        params.map === undefined
            ? complex(0)
            : div(boxPressure, scale(jw, params.map));
    const radiated = mul(mul(boxCompliance, zb), coneVolume);
    const impedance = add(ze, div(complex(params.bl ** 2), motional));

    return { velocity, radiated, port, rearPort: complex(0), impedance };
}
