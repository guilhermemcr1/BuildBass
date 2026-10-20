import { describe, expect, test } from 'vite-plus/test';
import { PARAMETERS } from '@/lib/parameters';
import { resources } from './index';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Map<string, string> {
    const entries = new Map<string, string>();

    for (const [key, value] of Object.entries(tree)) {
        const path = prefix === '' ? key : `${prefix}.${key}`;

        if (typeof value === 'string') {
            entries.set(path, value);
            continue;
        }

        for (const [nested, text] of flatten(value, path)) {
            entries.set(nested, text);
        }
    }

    return entries;
}

describe('traduções', () => {
    const portuguese = flatten(resources['pt-BR'] as unknown as Tree);
    const english = flatten(resources.en as unknown as Tree);

    test('pt-BR e en têm exatamente as mesmas chaves (SC-005)', () => {
        expect([...english.keys()].sort()).toEqual(
            [...portuguese.keys()].sort(),
        );
    });

    test('nenhuma tradução está vazia', () => {
        for (const [key, text] of [...portuguese, ...english]) {
            expect(text.trim(), key).not.toBe('');
        }
    });

    test('todo parâmetro tem nome e explicação', () => {
        for (const key of Object.keys(PARAMETERS)) {
            expect(portuguese.has(`parameters.${key}.label`), key).toBe(true);
            expect(portuguese.has(`parameters.${key}.help`), key).toBe(true);
        }
    });
});
