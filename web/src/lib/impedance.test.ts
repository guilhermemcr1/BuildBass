import { describe, expect, test } from 'vite-plus/test';
import {
    coilLoad,
    formatImpedance,
    isImpedance,
    parseOhms,
    parseVariant,
    voiceCoils,
} from './impedance';

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

describe('bobina dupla na variação', () => {
    test.each([
        ['4+4 Ω', { ohms: 4, coils: 2 }],
        ['2 + 2', { ohms: 2, coils: 2 }],
        ['1,5+1,5 ohms', { ohms: 1.5, coils: 2 }],
        ['4', { ohms: 4, coils: 1 }],
        ['4+2', null],
        ['4+', null],
        ['+4', null],
    ])('parseVariant(%j)', (value, expected) => {
        expect(parseVariant(value)).toEqual(expected);
    });

    test('formata como "N+N Ω" e é aceita no formulário', () => {
        expect(formatImpedance('4+4')).toBe('4+4 Ω');
        expect(formatImpedance('2 + 2 Ω')).toBe('2+2 Ω');
        expect(isImpedance('4+4 Ω')).toBe(true);
        expect(isImpedance('4+2 Ω')).toBe(false);
    });

    test('conta as bobinas e calcula a carga de cada ligação', () => {
        expect(voiceCoils('4+4 Ω')).toBe(2);
        expect(voiceCoils('4 Ω')).toBe(1);
        expect(voiceCoils(undefined)).toBe(1);
        expect(coilLoad({ ohms: 4, coils: 2 }, 'series')).toBe(8);
        expect(coilLoad({ ohms: 4, coils: 2 }, 'parallel')).toBe(2);
        expect(coilLoad({ ohms: 4, coils: 1 }, 'parallel')).toBe(4);
    });
});
