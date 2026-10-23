import { describe, expect, test } from 'vite-plus/test';
import { sceneToPdf } from './pdf';
import { buildScene } from './scene';
import {
    ALL_GROUPS,
    makeInput,
    NO_GROUPS,
    project,
    series,
} from './test-input';
import type { Scene } from './types';

const latin1 = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes);

function pdfOf(scene: Scene, page: 'a4' | 'letter' = 'a4'): string {
    return latin1(sceneToPdf(scene, page));
}

const scene = () => buildScene(makeInput(), ALL_GROUPS);

describe('sceneToPdf', () => {
    test('começa com %PDF-1.4 e termina com %%EOF', () => {
        const pdf = pdfOf(scene());

        expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
        expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    test('a tabela xref aponta para o começo real de cada objeto', () => {
        const pdf = pdfOf(scene());
        const start = Number(pdf.match(/startxref\n(\d+)\n%%EOF/)![1]);

        expect(pdf.slice(start, start + 4)).toBe('xref');

        const [, count] = pdf.slice(start).match(/xref\n0 (\d+)\n/)!;
        const entries = [
            ...pdf.slice(start).matchAll(/(\d{10}) (\d{5}) ([nf]) \n/g),
        ];

        expect(entries).toHaveLength(Number(count));
        entries.slice(1).forEach((entry, index) => {
            const offset = Number(entry[1]);

            expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(
                true,
            );
        });
    });

    test('página A4 ou Carta, paisagem', () => {
        expect(pdfOf(scene(), 'a4')).toContain('/MediaBox [0 0 842 595]');
        expect(pdfOf(scene(), 'letter')).toContain('/MediaBox [0 0 792 612]');
    });

    test('Helvetica e Helvetica-Bold com WinAnsi, sem fonte embutida', () => {
        const pdf = pdfOf(scene());

        expect(pdf).toContain('/BaseFont /Helvetica ');
        expect(pdf).toContain('/BaseFont /Helvetica-Bold ');
        expect(pdf.match(/\/Encoding \/WinAnsiEncoding/g)).toHaveLength(2);
        expect(pdf).not.toContain('/FontFile');
    });

    test('o conteúdo cabe na página, centralizado, sem passar das margens', () => {
        const pdf = pdfOf(scene(), 'a4');
        const content = pdf.slice(
            pdf.indexOf('stream\n') + 7,
            pdf.indexOf('endstream'),
        );
        const coordinates = [
            ...content.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) [ml]\n/g),
        ];

        expect(coordinates.length).toBeGreaterThan(100);
        coordinates.forEach(([, x, y]) => {
            expect(Number(x)).toBeGreaterThanOrEqual(0);
            expect(Number(x)).toBeLessThanOrEqual(842);
            expect(Number(y)).toBeGreaterThanOrEqual(0);
            expect(Number(y)).toBeLessThanOrEqual(595);
        });
    });

    test('todo texto da cena aparece no fluxo, com ( ) \\ escapados e acentos em um byte', () => {
        const name = 'Caixa (ação) \\ 2';
        const pdf = pdfOf(
            buildScene(
                makeInput({
                    projects: [project('a', { name })],
                    series: [series('a', { label: name })],
                }),
                NO_GROUPS,
            ),
        );

        expect(pdf).toContain('(Caixa \\(a\xe7\xe3o\\) \\\\ 2)');
        expect(pdf).toContain('(Resposta)');
        expect(pdf).toContain('(Frequ\xeancia \\(Hz\\))');
    });

    test('cada polilinha vira m/l/S e o tracejado vira d', () => {
        const pdf = pdfOf(
            buildScene(
                makeInput({ series: [series('a', { dashed: true })] }),
                NO_GROUPS,
            ),
        );

        expect(pdf).toMatch(/ m\n(?:[\d. -]+ l\n)+S\n/);
        expect(pdf).toMatch(/\[[\d. ]+\] 0 d\n/);
        expect(pdf).toContain('[] 0 d');
    });

    test('cores em rg/RG a partir do hex', () => {
        const pdf = pdfOf(scene());

        // Série 1: #4d7c0f.
        expect(pdf).toContain('0.302 0.486 0.059 RG');
        expect(pdf).toContain('1 1 1 rg');
    });

    test('texto girado usa a matriz de texto', () => {
        expect(pdfOf(scene())).toMatch(/0 1 -1 0 [\d.]+ [\d.]+ Tm/);
    });

    test('a mesma cena gera sempre os mesmos bytes', () => {
        expect(sceneToPdf(scene(), 'a4')).toEqual(sceneToPdf(scene(), 'a4'));
    });
});
