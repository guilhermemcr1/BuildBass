import { readFileSync } from 'node:fs';
import { render } from '@testing-library/react';
import { describe, expect, test } from 'vite-plus/test';
import { Flag } from './flag';

describe('Flag', () => {
    test.each(['br', 'us'] as const)(
        'a bandeira %s é decorativa: aria-hidden e fora da ordem de foco',
        (country) => {
            const { container } = render(<Flag country={country} />);
            const svg = container.querySelector('svg');

            expect(svg).toHaveAttribute('aria-hidden', 'true');
            expect(svg).toHaveAttribute('focusable', 'false');
            expect(svg).not.toHaveAttribute('role');
        },
    );

    test('usa só os tokens --flag-* para as cores', () => {
        for (const country of ['br', 'us'] as const) {
            const { container } = render(<Flag country={country} />);
            const fills = [...container.querySelectorAll('[fill]')].map(
                (node) => node.getAttribute('fill') ?? '',
            );

            expect(fills.length).toBeGreaterThan(0);
            for (const fill of fills) {
                expect(fill).toMatch(/^var\(--flag-[a-z-]+\)$/);
            }
        }
    });

    test('o código-fonte do componente não tem cor fixa', () => {
        const source = readFileSync('src/components/ui/flag.tsx', 'utf8');

        expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(source).not.toMatch(/rgb\(|hsl\(/);
    });

    test('Brasil e EUA desenham formas diferentes', () => {
        const br = render(<Flag country="br" />).container.innerHTML;
        const us = render(<Flag country="us" />).container.innerHTML;

        expect(br).toContain('flag-br-green');
        expect(us).toContain('flag-us-red');
        expect(br).not.toContain('flag-us');
    });
});
