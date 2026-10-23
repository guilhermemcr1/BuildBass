// Regras de eixo e de pico compartilhadas entre o gráfico da tela e a imagem exportada, para os
// dois mostrarem a mesma grade e o mesmo pico.

export type Peak = { index: number; value: number };

// Maior valor da curva dentro da faixa visível (o pico exibido no tooltip e marcado no gráfico).
export function peakOf(
    frequencies: readonly number[],
    values: (number | null)[],
    [min, max]: [number, number],
): Peak | undefined {
    let best: Peak | undefined;

    values.forEach((value, index) => {
        const frequency = frequencies[index];

        if (
            value === null ||
            frequency === undefined ||
            frequency < min ||
            frequency > max
        ) {
            return;
        }

        if (best === undefined || value > best.value) {
            best = { index, value };
        }
    });

    return best;
}

// Num eixo log só 1, 2 e 5 de cada década recebem rótulo; as demais linhas ficam só na grade. Com
// zoom de poucas oitavas todas as linhas ganham rótulo, senão sobraria quase nada para ler.
export function frequencyTick(value: number | null, all: boolean): string {
    if (value === null) {
        return '';
    }

    const mantissa = Number(
        (value / 10 ** Math.floor(Math.log10(value))).toPrecision(6),
    );

    if (!all && ![1, 2, 5].includes(mantissa)) {
        return '';
    }

    return value >= 1000 ? `${value / 1000}k` : String(value);
}

// Pontos do eixo de frequência: 1…9 de cada década; se a faixa visível for estreita (zoom), passa
// para meio em meio e depois para décimo em décimo até haver pelo menos 4 pontos para ler.
export function frequencySplits(min: number, max: number): number[] {
    for (const step of [10, 5, 1]) {
        const ticks: number[] = [];

        for (
            let decade = Math.floor(Math.log10(min));
            decade <= Math.ceil(Math.log10(max));
            decade++
        ) {
            const base = 10 ** decade;

            // Mantissa em décimos (10 = 1,0 … 99 = 9,9), inteira para não acumular erro de ponto
            // flutuante.
            for (let tenths = 10; tenths < 100; tenths += step) {
                const value = Number(((tenths * base) / 10).toPrecision(6));

                if (value >= min && value <= max) {
                    ticks.push(value);
                }
            }
        }

        if (ticks.length >= 4 || step === 1) {
            return ticks;
        }
    }

    return [];
}

// Degraus do eixo y: o menor passo permitido (1, 2 ou 5 por década, ou os de `incrs`) que deixa no
// máximo 8 intervalos entre `min` e `max`.
export function yTicks(min: number, max: number, incrs?: number[]): number[] {
    const span = max - min;

    if (!(span > 0)) {
        return [min];
    }

    const candidates =
        incrs ??
        Array.from({ length: 24 }, (_, index) => {
            const decade = 10 ** (Math.floor(index / 3) - 4);

            return [1, 2, 5][index % 3] * decade;
        });
    const step =
        [...candidates]
            .sort((a, b) => a - b)
            .find((candidate) => span / candidate <= 8) ??
        candidates[candidates.length - 1];
    const ticks: number[] = [];

    for (
        let value = Math.ceil(min / step - 1e-9) * step;
        value <= max + step * 1e-9;
        value += step
    ) {
        ticks.push(Number(value.toPrecision(12)));
    }

    return ticks;
}
