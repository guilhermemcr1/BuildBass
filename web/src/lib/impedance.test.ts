import { describe, expect, test } from 'vite-plus/test';
import { formatImpedance, isImpedance, parseOhms } from './impedance';

describe('impedância da variação', () => {
    test.each([
        ['4', 4],
        ['4 Ω', 4],
        ['3,2', 3.2],
        ['3.2 ohms', 3.2],
        ['0,5', 0.5],
        ['64', 64],
        ['0,4', null],
        ['65', null],
        ['4.255', null],
        ['Dual 4', null],
        ['', null],
        ['4 Ω Ω', null],
    ])('parseOhms(%j) = %s', (value, expected) => {
        expect(parseOhms(value)).toBe(expected);
    });

    test('formata sempre como "N Ω", com ponto nos decimais', () => {
        expect(formatImpedance('4')).toBe('4 Ω');
        expect(formatImpedance('3,20')).toBe('3.2 Ω');
        expect(formatImpedance('  ')).toBe('');
        expect(formatImpedance('Dual 4')).toBe('Dual 4');
    });

    test('vazio é aceito; texto livre não', () => {
        expect(isImpedance('')).toBe(true);
        expect(isImpedance('8 Ω')).toBe(true);
        expect(isImpedance('Dual 4')).toBe(false);
    });
});
