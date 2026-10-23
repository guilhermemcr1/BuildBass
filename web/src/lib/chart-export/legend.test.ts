import { describe, expect, test } from 'vite-plus/test';
import { peakOf } from './axes';
import { availableGroups, effectiveGroups, legendBlocks } from './legend';
import {
    ALL_GROUPS,
    bell,
    makeInput,
    NO_GROUPS,
    project,
    series,
} from './test-input';

const details = (blocks: ReturnType<typeof legendBlocks>, index = 0) =>
    blocks[index].rows.flatMap((row) =>
        row.type === 'detail' ? [row.text] : [],
    );

describe('legendBlocks', () => {
    test('sem grupos, só o nome do projeto com a cor', () => {
        const [block] = legendBlocks(
            makeInput({ projects: [project('a', { color: 3 })] }),
            NO_GROUPS,
        );

        expect(block.rows).toEqual([
            {
                type: 'series',
                color: 3,
                dashed: false,
                text: 'Projeto a',
                bold: true,
            },
        ]);
    });

    test('ordem: nome, pico, F-3/F-10, caixa (e driver e sinal)', () => {
        const input = makeInput();
        const blocks = legendBlocks(input, ALL_GROUPS);
        const peak = peakOf(
            input.frequencies,
            input.series[0].values,
            [10, 1000],
        )!;

        expect(details(blocks)).toEqual([
            `Pico ${input.formatValue(peak.value)} · ${input.formatFrequency(input.frequencies[peak.index])}`,
            'F-3 38 Hz · F-10 29 Hz',
            'Dutada · 52 L · Fb 36 Hz',
            'Fabricante Modelo',
            '500 W',
        ]);
    });

    test('pico que arredonda para zero não leva sinal', () => {
        const input = makeInput({
            series: [series('a', { values: bell(60, -0.0004) })],
            formatValue: (value) => `${value.toFixed(1).replace('.', ',')} dB`,
        });
        const [text] = details(
            legendBlocks(input, { ...NO_GROUPS, peak: true }),
        );

        expect(text).toMatch(/^Pico 0,0 dB · /);
    });

    test('o pico segue a faixa visível (zoom)', () => {
        const input = makeInput({ xRange: [100, 1000] });
        const [text] = details(
            legendBlocks(input, { ...NO_GROUPS, peak: true }),
        );
        const peak = peakOf(
            input.frequencies,
            input.series[0].values,
            [100, 1000],
        )!;

        expect(text).toContain(input.formatValue(peak.value));
        expect(text).toContain(
            input.formatFrequency(input.frequencies[peak.index]),
        );
    });

    test('F-3 abaixo da grade e F-10 sem dado não inventam número', () => {
        const [block] = legendBlocks(
            makeInput({
                projects: [
                    project('a', {
                        cutoffs: {
                            f3_below_range: true,
                            f10_below_range: true,
                        },
                    }),
                    project('b', { cutoffs: {} }),
                ],
            }),
            { ...NO_GROUPS, cutoffs: true },
        );
        const [, other] = legendBlocks(
            makeInput({
                projects: [project('a'), project('b', { cutoffs: {} })],
            }),
            { ...NO_GROUPS, cutoffs: true },
        );

        expect(details([block])).toEqual([
            'F-3 abaixo de 10 Hz · F-10 abaixo de 10 Hz',
        ]);
        expect(details([other])).toEqual(['F-3 — · F-10 —']);
    });

    test('bandpass mostra as bordas inferior e superior de −3 e de −10 dB', () => {
        const blocks = legendBlocks(
            makeInput({
                projects: [
                    project('a', {
                        bandpass: true,
                        cutoffs: {
                            f_low_hz: 38,
                            f_high_hz: 120,
                            f_low10_hz: 25,
                            f_high10_above_range: true,
                        },
                    }),
                ],
            }),
            { ...NO_GROUPS, cutoffs: true },
        );

        expect(details(blocks)).toEqual([
            'F-3 38 Hz – 120 Hz',
            'F-10 25 Hz – acima de 1 kHz',
        ]);
    });

    test('limite: ultrapassado quando algum ponto visível passa dele, dentro quando não', () => {
        const input = makeInput({
            kind: 'excursion',
            series: [series('a', { values: bell(60, 9) })],
            limits: [
                { value: 5, tone: 'warn', label: 'Xmax 5 mm' },
                { value: 50, tone: 'error', label: 'Limite 50 mm' },
            ],
        });
        const [block] = legendBlocks(input, { ...NO_GROUPS, limits: true });
        const rows = block.rows.filter((row) => row.type === 'detail');

        expect(rows).toEqual([
            { type: 'detail', text: 'Xmax 5 mm · ultrapassado', tone: 'warn' },
            {
                type: 'detail',
                text: 'Limite 50 mm · dentro do limite',
                tone: undefined,
            },
        ]);
    });

    test('limite ignora pontos fora da faixa visível', () => {
        // O pico (60 Hz) fica fora de 200–1000 Hz, onde a curva já está abaixo do limite.
        const input = makeInput({
            kind: 'excursion',
            xRange: [200, 1000],
            series: [series('a', { values: bell(60, 9) })],
            limits: [{ value: 5, tone: 'warn', label: 'Xmax 5 mm' }],
        });
        const [text] = details(
            legendBlocks(input, { ...NO_GROUPS, limits: true }),
        );

        expect(text).toBe('Xmax 5 mm · dentro do limite');
    });

    test('bandpass de 6ª ordem: uma linha de série e um pico por duto', () => {
        const input = makeInput({
            kind: 'portVelocity',
            series: [
                series('a', { label: 'Projeto a — frontal' }),
                series('a-rear', {
                    label: 'Projeto a — traseiro',
                    dashed: true,
                    values: bell(40, 20),
                }),
            ],
            projects: [project('a', { seriesIds: ['a', 'a-rear'] })],
        });
        const [block] = legendBlocks(input, { ...NO_GROUPS, peak: true });
        const rows = block.rows;

        expect(rows.filter((row) => row.type === 'series')).toEqual([
            expect.objectContaining({
                text: 'Projeto a — frontal',
                dashed: false,
            }),
            expect.objectContaining({
                text: 'Projeto a — traseiro',
                dashed: true,
            }),
        ]);
        expect(details([block])).toEqual([
            expect.stringMatching(/^frontal · Pico /),
            expect.stringMatching(/^traseiro · Pico /),
        ]);
    });

    test('caixa sem sintonia nem driver não gera linhas vazias', () => {
        const [block] = legendBlocks(
            makeInput({
                projects: [
                    project('a', {
                        box: { type: 'Selada', volume: '40 L', tuning: '' },
                        driver: '',
                        signal: '',
                    }),
                ],
            }),
            { ...NO_GROUPS, box: true },
        );

        expect(details([block])).toEqual(['Selada · 40 L']);
    });
});

describe('availableGroups', () => {
    const limit = { value: 1, tone: 'warn' as const, label: 'x' };

    test('F-3/F-10 só na resposta; limites só em excursão e velocidade com limite', () => {
        expect(availableGroups('response', []).cutoffs.available).toBe(true);
        expect(availableGroups('response', [limit]).limits.available).toBe(
            false,
        );
        expect(availableGroups('excursion', [limit])).toMatchObject({
            cutoffs: {
                available: false,
                reasonKey: 'charts.export.unavailable.cutoffs',
            },
            limits: { available: true },
        });
        expect(availableGroups('portVelocity', [limit]).limits.available).toBe(
            true,
        );
        expect(availableGroups('excursion', []).limits).toEqual({
            available: false,
            reasonKey: 'charts.export.unavailable.limits',
        });
        expect(availableGroups('impedance', [limit]).limits.available).toBe(
            false,
        );
        expect(availableGroups('groupDelay', []).peak.available).toBe(true);
        expect(availableGroups('groupDelay', []).box.available).toBe(true);
    });

    test('grupos ligados mas indisponíveis ficam de fora', () => {
        expect(effectiveGroups(ALL_GROUPS, 'impedance', [limit])).toEqual({
            peak: true,
            cutoffs: false,
            box: true,
            limits: false,
        });
    });
});
