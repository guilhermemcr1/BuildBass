import { describe, expect, test } from 'vite-plus/test';
import { LOCALES, resources } from '@/i18n';
import { QUANTITIES } from '@/lib/units/quantities';
import { toWinAnsi } from './text';

type Tree = { [key: string]: string | Tree };

function strings(tree: Tree): string[] {
    return Object.values(tree).flatMap((value) =>
        typeof value === 'string' ? [value] : strings(value),
    );
}

// Tudo o que pode aparecer na imagem: nomes e eixos dos gráficos, tipos de caixa, rótulos de limite
// e de legenda, símbolos de unidade. Se algum tiver caractere fora do WinAnsi (que o PDF com fonte
// padrão não desenha), o SVG e o PDF passariam a dizer coisas diferentes.
describe('textos da imagem cabem no WinAnsi (SC-004)', () => {
    const symbols = Object.values(QUANTITIES).flatMap((quantity) =>
        quantity.units.map((unit) => unit.symbol),
    );

    test.each(LOCALES)('%s', (locale) => {
        const { workbench, engine } = resources[locale];
        const texts = [
            ...strings(workbench.charts as Tree),
            ...strings(workbench.boxType as Tree),
            ...strings(engine.limits as Tree),
            ...strings(engine.charts as Tree),
            ...symbols,
        ].map((text) => text.replace(/\{\{[^}]+\}\}/g, '1'));

        expect(texts.length).toBeGreaterThan(40);
        texts.forEach((text) => {
            if (text.includes('?')) {
                return;
            }

            expect(toWinAnsi(text), text).not.toContain('?');
        });
    });
});
