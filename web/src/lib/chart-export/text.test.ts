import { describe, expect, test } from 'vite-plus/test';
import { measure, toWinAnsi, wrap } from './text';

describe('measure', () => {
    test('usa as larguras da Helvetica (1/1000 em)', () => {
        // H = 722, z = 500
        expect(measure('Hz', 10, false)).toBeCloseTo(12.22, 5);
        // Em negrito: H = 722, z = 500; e o "a" muda de 556 para 556, o "b" de 556 para 611.
        expect(measure('b', 10, true)).toBeCloseTo(6.11, 5);
    });

    test('letra acentuada mede como a letra-base', () => {
        expect(measure('é', 12, false)).toBe(measure('e', 12, false));
        expect(measure('Ç', 12, false)).toBe(measure('C', 12, false));
    });

    test('cresce com o tamanho', () => {
        expect(measure('Pico', 20, false)).toBeCloseTo(
            2 * measure('Pico', 10, false),
            9,
        );
    });
});

describe('wrap', () => {
    test('quebra em espaço sem passar da largura', () => {
        const lines = wrap('Caixa dutada com duas câmaras', 10, false, 80);

        expect(lines.length).toBeGreaterThan(1);
        lines.forEach((line) => {
            expect(line).not.toBe('');
            expect(measure(line, 10, false)).toBeLessThanOrEqual(80);
        });
        expect(lines.join(' ')).toBe('Caixa dutada com duas câmaras');
    });

    test('palavra maior que a linha fica sozinha, sem linha vazia', () => {
        const lines = wrap('Supercalifragilistico', 10, false, 20);

        expect(lines).toEqual(['Supercalifragilistico']);
    });

    test('texto vazio devolve uma lista vazia', () => {
        expect(wrap('', 10, false, 80)).toEqual([]);
    });
});

describe('toWinAnsi', () => {
    test('troca o que o conjunto WinAnsi não tem', () => {
        expect(toWinAnsi('Impedância (Ω)')).toBe('Impedância (ohm)');
        expect(toWinAnsi('−3 dB')).toBe('-3 dB');
        expect(toWinAnsi('≈ 40 Hz')).toBe('~ 40 Hz');
        expect(toWinAnsi('10 Hz')).toBe('10 Hz');
        expect(toWinAnsi('10 Hz')).toBe('10 Hz');
    });

    test('mantém acentos, grau, ponto médio e travessão', () => {
        expect(toWinAnsi('ação · 90° — µs')).toBe('ação · 90° — µs');
    });

    test('o que sobrar fora do conjunto vira "?"', () => {
        expect(toWinAnsi('a中b')).toBe('a?b');
    });
});
