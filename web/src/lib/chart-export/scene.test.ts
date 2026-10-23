import { describe, expect, test } from 'vite-plus/test';
import { PAPER, SERIES_PAPER } from './palette';
import { buildScene } from './scene';
import {
    ALL_GROUPS,
    bell,
    makeInput,
    NO_GROUPS,
    project,
    series,
} from './test-input';
import { measure } from './text';
import type { Primitive } from './types';

const texts = (items: Primitive[]) =>
    items.flatMap((item) => (item.type === 'text' ? [item] : []));
const polylines = (items: Primitive[]) =>
    items.flatMap((item) => (item.type === 'polyline' ? [item] : []));

describe('buildScene (sem legenda)', () => {
    test('cena de 1000 × 707 com fundo branco', () => {
        const scene = buildScene(makeInput(), NO_GROUPS);

        expect(scene.width).toBe(1000);
        expect(scene.height).toBe(707);
        expect(scene.items[0]).toMatchObject({
            type: 'rect',
            x: 0,
            y: 0,
            w: 1000,
            h: 707,
            fill: PAPER.background,
        });
    });

    test('uma polilinha por série, na cor de papel do projeto, tracejada quando dashed', () => {
        const scene = buildScene(
            makeInput({
                series: [
                    series('a', { color: 2 }),
                    series('b', { color: 4, dashed: true }),
                ],
            }),
            NO_GROUPS,
        );
        const curves = polylines(scene.items).filter(
            (line) => line.width >= 1.5,
        );

        expect(curves).toHaveLength(2);
        expect(curves[0].stroke).toBe(SERIES_PAPER[2]);
        expect(curves[0].dash).toBeUndefined();
        expect(curves[1].stroke).toBe(SERIES_PAPER[4]);
        expect(curves[1].dash).toBeDefined();
    });

    test('valor nulo quebra a linha em segmentos', () => {
        const values = series('a').values.map((value, index) =>
            index === 100 ? null : value,
        );
        const scene = buildScene(
            makeInput({ series: [series('a', { values })] }),
            NO_GROUPS,
        );

        expect(
            polylines(scene.items).filter((line) => line.width >= 1.5),
        ).toHaveLength(2);
    });

    test('eixo x logarítmico limitado à faixa pedida', () => {
        const scene = buildScene(makeInput({ xRange: [10, 1000] }), NO_GROUPS);
        const curve = polylines(scene.items).find((line) => line.width >= 1.5)!;
        const xs = curve.points.map(([x]) => x);
        const left = Math.min(...xs);
        const right = Math.max(...xs);
        // 100 Hz fica no meio de 10 Hz…1 kHz em escala log.
        const index = makeInput().frequencies.findIndex(
            (hz) => Math.abs(hz - 100) < 1e-6,
        );

        expect(curve.points[index][0]).toBeCloseTo((left + right) / 2, 0);
    });

    test('zoom corta a curva na faixa visível', () => {
        const scene = buildScene(makeInput({ xRange: [40, 100] }), NO_GROUPS);
        const curve = polylines(scene.items).find((line) => line.width >= 1.5)!;
        const full = polylines(buildScene(makeInput(), NO_GROUPS).items).find(
            (line) => line.width >= 1.5,
        )!;

        expect(curve.points.length).toBeLessThan(full.points.length);
    });

    test('título com o nome do gráfico, data na locale e rótulos dos eixos', () => {
        const scene = buildScene(makeInput(), NO_GROUPS);
        const all = texts(scene.items).map((item) => item.text);

        expect(all).toContain('Resposta');
        expect(all).toContain('23 de out. de 2026');
        expect(all).toContain('Frequência (Hz)');
        expect(all).toContain('Nível (dB)');
        expect(all).toContain('Projeto a');
    });

    test('todo texto cabe no WinAnsi e dentro da cena', () => {
        const scene = buildScene(
            makeInput({ yLabel: 'Impedância (Ω)', title: 'Excursão' }),
            NO_GROUPS,
        );

        texts(scene.items).forEach((item) => {
            expect(item.text).not.toMatch(/[Ω−≈]/);
            expect(item.x).toBeGreaterThanOrEqual(0);
            expect(item.x).toBeLessThanOrEqual(1000);
            expect(item.y).toBeGreaterThanOrEqual(0);
            expect(item.y).toBeLessThanOrEqual(707);

            if (item.rotate === undefined) {
                const width = measure(item.text, item.size, item.bold);
                const left =
                    item.anchor === 'start'
                        ? item.x
                        : item.anchor === 'middle'
                          ? item.x - width / 2
                          : item.x - width;

                expect(left).toBeGreaterThanOrEqual(0);
                expect(left + width).toBeLessThanOrEqual(1000);
            }
        });
    });

    test('é determinística', () => {
        expect(buildScene(makeInput(), NO_GROUPS)).toEqual(
            buildScene(makeInput(), NO_GROUPS),
        );
    });

    test('sem faixa y pedida, calcula uma que cobre os dados', () => {
        const scene = buildScene(
            makeInput({
                kind: 'excursion',
                yRange: undefined,
                yIncrs: undefined,
                series: [series('a', { values: bellMm() })],
            }),
            NO_GROUPS,
        );
        const curve = polylines(scene.items).find((line) => line.width >= 1.5)!;

        curve.points.forEach(([, y]) => {
            expect(y).toBeGreaterThanOrEqual(84);
            expect(y).toBeLessThanOrEqual(625);
        });
    });
});

function bellMm(): number[] {
    return makeInput().series[0].values.map((value) => (value ?? 0) / 10);
}

describe('buildScene (com legenda)', () => {
    const circles = (items: Primitive[]) =>
        items.flatMap((item) => (item.type === 'circle' ? [item] : []));
    const legendTexts = (items: Primitive[]) =>
        texts(items).filter((item) => item.anchor === 'start' && item.x >= 700);

    test('pico ligado marca um círculo por série, na cor dela', () => {
        const input = makeInput({
            series: [series('a', { color: 2 }), series('b', { color: 5 })],
            projects: [project('a', { color: 2 }), project('b', { color: 5 })],
        });
        const marks = circles(buildScene(input, ALL_GROUPS).items);

        expect(marks.map((mark) => mark.fill)).toEqual([
            SERIES_PAPER[2],
            SERIES_PAPER[5],
        ]);
        expect(circles(buildScene(input, NO_GROUPS).items)).toHaveLength(0);
    });

    test('o círculo do pico fica sobre a curva, no ponto de maior valor', () => {
        const scene = buildScene(makeInput(), { ...NO_GROUPS, peak: true });
        const curve = polylines(scene.items).find((line) => line.width >= 1.5)!;
        const [mark] = circles(scene.items);
        const top = Math.min(...curve.points.map(([, y]) => y));

        expect(mark.cy).toBeCloseTo(top, 1);
    });

    test('limites ligados desenham a linha e o trecho acima dele', () => {
        const input = makeInput({
            kind: 'excursion',
            yRange: [0, 12],
            yIncrs: undefined,
            series: [series('a', { values: bell(60, 9) })],
            limits: [
                { value: 5, tone: 'warn', label: 'Xmax 5 mm', highlight: true },
            ],
        });
        const on = buildScene(input, { ...NO_GROUPS, limits: true });
        const off = buildScene(input, NO_GROUPS);
        const dashed = on.items.filter(
            (item) => item.type === 'line' && item.stroke === PAPER.warn,
        );
        const over = polylines(on.items).filter(
            (line) => line.stroke === PAPER.warn,
        );

        expect(dashed).toHaveLength(1);
        expect(over.length).toBeGreaterThan(0);
        expect(
            off.items.filter(
                (item) => 'stroke' in item && item.stroke === PAPER.warn,
            ),
        ).toHaveLength(0);
        expect(texts(on.items).map((item) => item.text)).toContain('Xmax 5 mm');
    });

    test('grupo indisponível na aba é ignorado mesmo ligado', () => {
        const scene = buildScene(
            makeInput({ kind: 'impedance', yLabel: 'Impedância (Ω)' }),
            ALL_GROUPS,
        );
        const all = texts(scene.items).map((item) => item.text);

        expect(all.some((text) => text.startsWith('F-3'))).toBe(false);
        expect(all.some((text) => text.startsWith('Dutada'))).toBe(true);
        expect(all).toContain('Impedância (ohm)');
    });

    test('cinco projetos com os quatro grupos cabem na coluna, sem texto fora da área', () => {
        const ids = ['a', 'b', 'c', 'd', 'e'];
        const input = makeInput({
            kind: 'portVelocity',
            yRange: undefined,
            yIncrs: undefined,
            limits: [
                { value: 17, tone: 'warn', label: 'Aviso 17 m/s' },
                { value: 25, tone: 'error', label: 'Erro 25 m/s' },
            ],
            series: ids.flatMap((id, index) => [
                series(id, {
                    color: ((index % 6) + 1) as 1,
                    label: `Projeto ${id} — frontal`,
                }),
                series(`${id}-rear`, {
                    color: ((index % 6) + 1) as 1,
                    dashed: true,
                    label: `Projeto ${id} — traseiro`,
                }),
            ]),
            projects: ids.map((id, index) =>
                project(id, {
                    color: ((index % 6) + 1) as 1,
                    seriesIds: [id, `${id}-rear`],
                    bandpass: true,
                }),
            ),
        });
        const scene = buildScene(input, ALL_GROUPS);
        const side = legendTexts(scene.items);

        expect(side.length).toBeGreaterThan(30);
        expect(side.some((item) => item.text.startsWith('+'))).toBe(false);
        side.forEach((item) => {
            expect(
                item.x + measure(item.text, item.size, item.bold),
            ).toBeLessThanOrEqual(969);
            expect(item.y).toBeLessThanOrEqual(676);
            expect(item.y).toBeGreaterThanOrEqual(84);
        });
        // Nenhuma linha da legenda passa por cima da outra.
        const rows = side.map((item) => item.y).sort((a, b) => a - b);

        rows.slice(1).forEach((y, index) => {
            expect(y - rows[index]).toBeGreaterThan(0.01);
        });
    });

    test('quando nem o tamanho compacto cabe, mostra os primeiros e termina com "+N projetos"', () => {
        const ids = Array.from({ length: 14 }, (_, index) => `p${index}`);
        const input = makeInput({
            series: ids.map((id) => series(id)),
            projects: ids.map((id) => project(id)),
        });
        const side = legendTexts(buildScene(input, ALL_GROUPS).items);
        const more = side.find((item) => item.text.startsWith('+'));

        expect(more).toBeDefined();
        expect(more!.y).toBeLessThanOrEqual(676);
        side.forEach((item) => expect(item.y).toBeLessThanOrEqual(676));
    });

    test('nome longo de projeto quebra em linhas e não estoura a coluna', () => {
        const name =
            'Subwoofer duplo com câmara frontal grande & saída <lateral> "extra"';
        const input = makeInput({
            projects: [project('a', { name })],
            series: [series('a', { label: name })],
        });
        const side = legendTexts(buildScene(input, NO_GROUPS).items);

        expect(side.length).toBeGreaterThan(1);
        side.forEach((item) => {
            expect(
                item.x + measure(item.text, item.size, item.bold),
            ).toBeLessThanOrEqual(969);
        });
        expect(side.map((item) => item.text).join(' ')).toContain('&');
    });
});

describe('buildScene (idioma)', () => {
    test('a data segue a locale da entrada', () => {
        const pt = buildScene(makeInput({ locale: 'pt-BR' }), NO_GROUPS);
        const en = buildScene(makeInput({ locale: 'en' }), NO_GROUPS);

        expect(texts(pt.items).map((item) => item.text)).toContain(
            '23 de out. de 2026',
        );
        expect(texts(en.items).map((item) => item.text)).toContain(
            'Oct 23, 2026',
        );
    });

    test('os números do eixo y seguem o separador decimal da locale', () => {
        const input = (locale: string) =>
            makeInput({
                locale,
                yRange: [0, 2],
                yIncrs: [0.5],
                series: [series('a', { values: bell(60, 1.2) })],
            });
        const decimals = (locale: string) =>
            texts(buildScene(input(locale), NO_GROUPS).items)
                .map((item) => item.text)
                .filter((text) => /^\d[.,]\d$/.test(text));

        expect(decimals('pt-BR')).toContain('0,5');
        expect(decimals('en')).toContain('0.5');
    });
});
