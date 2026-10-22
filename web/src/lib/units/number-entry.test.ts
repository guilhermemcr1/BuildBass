import { describe, expect, it } from 'vitest';
import { normalizePasted, separatorsOf, typedSeparator } from './number-entry';

describe('separatorsOf', () => {
    it('lê o decimal e o milhar de cada idioma', () => {
        expect(separatorsOf('pt-BR')).toEqual({ decimal: ',', group: '.' });
        expect(separatorsOf('en')).toEqual({ decimal: '.', group: ',' });
    });
});

describe('typedSeparator', () => {
    it('ponto e vírgula digitados viram o decimal do idioma', () => {
        expect(typedSeparator('.', 'pt-BR')).toBe(',');
        expect(typedSeparator(',', 'en')).toBe('.');
        expect(typedSeparator('5', 'en')).toBe('5');
    });
});

describe('normalizePasted', () => {
    it.each([
        ['28.5', 'pt-BR', '28,5'],
        ['28,5', 'pt-BR', '28,5'],
        ['28,5', 'en', '28.5'],
        ['28.5', 'en', '28.5'],
        ['1.000', 'pt-BR', '1000'],
        ['1,000', 'en', '1000'],
        ['1.000,5', 'pt-BR', '1000,5'],
        ['1,000.5', 'en', '1000.5'],
        ['12.345.678', 'pt-BR', '12345678'],
        ['0.380', 'pt-BR', '0,38'],
        ['1e3', 'pt-BR', '1000'],
        ['2.5e-2', 'en', '0.025'],
        ['28 Hz', 'pt-BR', '28'],
        ['  30  ', 'en', '30'],
        ['−5', 'en', '-5'],
        ['1 000', 'pt-BR', '1000'],
    ])('%s (%s) → %s', (raw, locale, expected) => {
        expect(normalizePasted(raw, locale)).toBe(expected);
    });

    it.each(['', 'abc', '--', 'Infinity', '1e999'])(
        'sem número aproveitável: %j',
        (raw) => {
            expect(normalizePasted(raw, 'pt-BR')).toBeUndefined();
        },
    );
});
