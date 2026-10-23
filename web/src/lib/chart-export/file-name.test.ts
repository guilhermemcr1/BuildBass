import { describe, expect, test } from 'vite-plus/test';
import { fileNameFor } from './file-name';

describe('fileNameFor', () => {
    const date = new Date(2026, 9, 23);

    test('projeto, gráfico e data', () => {
        expect(fileNameFor('Caixa Ação #1', 'response', date, 'png')).toBe(
            'caixa-acao-1-response-2026-10-23.png',
        );
    });

    test('nome vazio vira "projeto"', () => {
        expect(fileNameFor('', 'groupDelay', date, 'png')).toBe(
            'projeto-groupDelay-2026-10-23.png',
        );
    });

    test('extensão do formato', () => {
        expect(fileNameFor('x', 'excursion', date, 'pdf')).toBe(
            'x-excursion-2026-10-23.pdf',
        );
    });

    test('não deixa caractere inválido para arquivo', () => {
        expect(fileNameFor('a/b\\c:d*?"<>|', 'impedance', date, 'png')).toMatch(
            /^[a-z0-9.-]+$/,
        );
    });
});
