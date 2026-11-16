import { ANALYSIS_FREQUENCIES_HZ } from './frequencies';

// Apoio da caixa bandpass de 4ª ordem. O circuito em si
// fica em circuit.ts; aqui só o que é específico da bandpass.

// O magneto e o cesto do driver ficam na câmara traseira (o cone fica de frente para a câmara
// frontal), então o volume dos drivers sai dela; o duto sai da frontal (port.ts) ([D06]).
export function rearNetVolume(
    rear_m3: number,
    driversVolume_m3: number,
): number {
    return rear_m3 - driversVolume_m3;
}

// Frequência em que se mede o vazamento da câmara traseira, QL = ω·Ral·Cr: a ressonância do
// driver na câmara traseira sozinha, fc = Fs·√(1 + Vas/Vr) ([S73c] eq. 10).
export function rearLossReferenceHz(
    fs_hz: number,
    vas_m3: number,
    rearPerDriver_m3: number,
): number {
    return fs_hz * Math.sqrt(1 + vas_m3 / rearPerDriver_m3);
}

export type BandEdges = {
    peak_db: number;
    f_low_hz?: number;
    f_high_hz?: number;
    f_center_hz?: number;
    bandwidth_oct?: number;
    // O corte inferior cai abaixo da grade (10 Hz) / o superior acima dela (1000 Hz).
    below_range: boolean;
    above_range: boolean;
};

// Bordas de −3 dB (ou de `dropDb`) em relação ao pico da curva. O corte inferior é o cruzamento
// mais externo buscado do início da grade para dentro, o superior do fim para dentro (como o F3 da
// selada); cada cruzamento é refinado por bisseção em log f. A frequência central é a média
// geométrica e a largura vem em oitavas.
export function bandEdges(
    level: (frequency: number) => number,
    dropDb = 3,
): BandEdges {
    const grid = ANALYSIS_FREQUENCIES_HZ;
    const levels = grid.map(level);
    const peak = Math.max(...levels);
    const threshold = peak - dropDb;

    // Cruzamento entre `inside` (nível ≥ limiar) e `outside` (nível < limiar).
    const refine = (inside: number, outside: number): number => {
        let near = Math.log(inside);
        let far = Math.log(outside);

        for (let step = 0; step < 50; step++) {
            const middle = (near + far) / 2;

            if (level(Math.exp(middle)) >= threshold) {
                near = middle;
            } else {
                far = middle;
            }
        }

        return Math.exp((near + far) / 2);
    };

    const first = levels.findIndex((value) => value >= threshold);
    let last = levels.length - 1;

    while (levels[last] < threshold) {
        last--;
    }

    const belowRange = first === 0;
    const aboveRange = last === grid.length - 1;
    const low = belowRange ? undefined : refine(grid[first], grid[first - 1]);
    const high = aboveRange ? undefined : refine(grid[last], grid[last + 1]);
    const both = low !== undefined && high !== undefined;

    return {
        peak_db: peak,
        f_low_hz: low,
        f_high_hz: high,
        f_center_hz: both ? Math.sqrt(low * high) : undefined,
        bandwidth_oct: both ? Math.log2(high / low) : undefined,
        below_range: belowRange,
        above_range: aboveRange,
    };
}
