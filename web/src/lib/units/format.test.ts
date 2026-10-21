import { describe, expect, test } from 'vite-plus/test';
import { EMPTY_VALUE, formatQuantity } from './format';
import { findUnit, QUANTITIES } from './quantities';

describe('formatação de grandezas', () => {
    test('usa vírgula em pt-BR e ponto em en', () => {
        expect(formatQuantity(28.5, 'Hz', 'pt-BR')).toBe('28,5');
        expect(formatQuantity(28.5, 'Hz', 'en')).toBe('28.5');
    });

    test('aplica as casas decimais da unidade exibida', () => {
        expect(formatQuantity(0.085, 'L', 'pt-BR')).toBe('85,0');
        expect(formatQuantity(0.085, 'ft3', 'pt-BR')).toBe('3,00');
    });

    test('não usa notação científica em valores pequenos', () => {
        expect(formatQuantity(0.00045, 'H', 'en')).toBe('0.00045');
        expect(formatQuantity(0.00045, 'mH', 'en')).toBe('0.45');
    });

    test('largura de banda em oitavas', () => {
        expect(formatQuantity(1.5, 'oct', 'pt-BR')).toBe('1,50');
        expect(findUnit('oct').symbol).toBe('oct');
        expect(QUANTITIES.octaves.siUnit).toBe('oct');
    });

    test('mostra traço quando não há valor', () => {
        expect(formatQuantity(undefined, 'Hz', 'pt-BR')).toBe(EMPTY_VALUE);
        expect(formatQuantity(Number.NaN, 'Hz', 'pt-BR')).toBe(EMPTY_VALUE);
    });
});
