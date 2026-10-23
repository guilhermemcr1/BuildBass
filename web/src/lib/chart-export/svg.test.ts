import { describe, expect, test } from 'vite-plus/test';
import { buildScene } from './scene';
import { sceneToSvg } from './svg';
import { makeInput, NO_GROUPS, project, series } from './test-input';

describe('sceneToSvg', () => {
    test('SVG com o tamanho e o viewBox da cena', () => {
        const svg = sceneToSvg(buildScene(makeInput(), NO_GROUPS));

        expect(svg).toContain('viewBox="0 0 1000 707"');
        expect(svg).toContain('width="1000"');
        expect(svg).toContain('height="707"');
        expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(svg).toContain('font-family="Helvetica, Arial, sans-serif"');
    });

    test('escapa texto de nome de projeto', () => {
        const svg = sceneToSvg(
            buildScene(
                makeInput({
                    projects: [project('a', { name: `A&B <x> "q" 'z'` })],
                    series: [series('a', { label: `A&B <x> "q" 'z'` })],
                }),
                NO_GROUPS,
            ),
        );

        expect(svg).toContain('A&amp;B &lt;x&gt; &quot;q&quot; &#39;z&#39;');
        expect(svg).not.toContain('<x>');
    });

    test('sem script nem referência externa', () => {
        const svg = sceneToSvg(buildScene(makeInput(), NO_GROUPS));

        expect(svg).not.toMatch(/<script|href=|<image|<foreignObject/i);
    });

    test('a mesma cena gera sempre a mesma string', () => {
        const scene = buildScene(makeInput(), NO_GROUPS);

        expect(sceneToSvg(scene)).toBe(sceneToSvg(scene));
    });

    test('tracejado vira stroke-dasharray', () => {
        const svg = sceneToSvg(
            buildScene(
                makeInput({ series: [series('a', { dashed: true })] }),
                NO_GROUPS,
            ),
        );

        expect(svg).toContain('stroke-dasharray=');
    });
});
