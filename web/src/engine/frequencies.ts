// Grade logarítmica com 180 pontos por década. A grade de análise (10 Hz a
// 1000 Hz) é onde o motor mede F3, bordas de −3 dB e velocidades máximas: o modelo de baixas
// frequências não vale acima disso, e a queda de agudos faria o F3 (buscado do topo) cair no lugar
// errado. A grade das curvas segue com os mesmos pontos e continua até 20 kHz, só para o gráfico.
const START_HZ = 10;
const STEPS_PER_DECADE = 180;
const ANALYSIS_DECADES = 2;

export const ANALYSIS_MAX_HZ = 1000;
export const CHART_MAX_HZ = 20000;

const at = (index: number) => START_HZ * 10 ** (index / STEPS_PER_DECADE);

export const ANALYSIS_FREQUENCIES_HZ: readonly number[] = Object.freeze(
    Array.from(
        { length: ANALYSIS_DECADES * STEPS_PER_DECADE + 1 },
        (_, index) => at(index),
    ),
);

function chartGrid(): number[] {
    const grid = [...ANALYSIS_FREQUENCIES_HZ];

    for (let index = grid.length; at(index) < CHART_MAX_HZ; index++) {
        grid.push(at(index));
    }

    grid.push(CHART_MAX_HZ);

    return grid;
}

export const FREQUENCIES_HZ: readonly number[] = Object.freeze(chartGrid());
