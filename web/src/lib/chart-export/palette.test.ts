import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import { PAPER, SERIES_PAPER } from './palette';

const css = readFileSync(resolve(process.cwd(), 'src/styles/app.css'), 'utf8');

// Bloco do tema claro: do primeiro `:root` até o próximo seletor de tema.
const light = css.slice(
    css.indexOf(':root'),
    css.indexOf("[data-theme='dark']"),
);

function token(name: string): string {
    const match = light.match(new RegExp(`--${name}:\\s*([^;]+);`));

    if (match === null) {
        throw new Error(`token --${name} não achado no tema claro`);
    }

    const value = match[1].trim();
    const reference = value.match(/^var\(--([\w-]+)\)$/);

    return reference === null ? value : token(reference[1]);
}

function luminance(hex: string): number {
    const [r, g, b] = [1, 3, 5].map((start) => {
        const channel = parseInt(hex.slice(start, start + 2), 16) / 255;

        return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (light + 0.05) / (dark + 0.05);
}

describe('palette de papel', () => {
    test('as cores de série são as do tema claro', () => {
        ([1, 2, 3, 4, 5, 6] as const).forEach((n) => {
            expect(SERIES_PAPER[n]).toBe(token(`series-${n}`));
        });
    });

    test('as cores de apoio são as do tema claro', () => {
        expect(PAPER.text).toBe(token('foreground'));
        expect(PAPER.muted).toBe(token('muted'));
        expect(PAPER.grid).toBe(token('border'));
        expect(PAPER.warn).toBe(token('status-warn'));
        expect(PAPER.error).toBe(token('status-error'));
    });

    test('texto e séries têm contraste mínimo sobre o fundo branco (4,5:1)', () => {
        expect(contrast(PAPER.text, PAPER.background)).toBeGreaterThanOrEqual(
            4.5,
        );
        expect(contrast(PAPER.muted, PAPER.background)).toBeGreaterThanOrEqual(
            4.5,
        );
        Object.values(SERIES_PAPER).forEach((color) => {
            expect(contrast(color, PAPER.background)).toBeGreaterThanOrEqual(
                4.5,
            );
        });
    });
});
