// Grade logarítmica de 10 Hz a 1000 Hz com 180 pontos por década (research.md §3).
const START_HZ = 10;
const DECADES = 2;
const STEPS_PER_DECADE = 180;

export const FREQUENCIES_HZ: readonly number[] = Object.freeze(
    Array.from(
        { length: DECADES * STEPS_PER_DECADE + 1 },
        (_, index) => START_HZ * 10 ** (index / STEPS_PER_DECADE),
    ),
);
