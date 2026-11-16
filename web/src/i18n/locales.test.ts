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

    test('pt-BR e en têm exatamente as mesmas chaves', () => {
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

    test('as chaves da bandpass de 6ª ordem existem nos dois idiomas', () => {
        const keys = [
            'workbench.boxType.bandpass6',
            'workbench.chambers.rear',
            'workbench.chambers.front',
            'workbench.port.titleRear',
            'workbench.results.fbRear',
            'workbench.results.portLengthFront',
            'workbench.results.portLengthRear',
            'workbench.results.portVelocityFront',
            'workbench.results.portVelocityRear',
            'workbench.charts.seriesFront',
            'workbench.charts.seriesRear',
            'engine.warnings.portVolumeTooLarge_rear',
            'engine.warnings.portVolumeTooLarge_front',
            'engine.warnings.portTooShort_rear',
            'engine.warnings.portTooShort_front',
            'engine.warnings.portTooLong_rear',
            'engine.warnings.portTooLong_front',
            'cutplan.types.bandpass6',
            'cutplan.warnings.portLongerThanDepth_rear',
            'cutplan.warnings.portLongerThanDepth_front',
            'cutplan.warnings.portUnknown_rear',
            'cutplan.warnings.portUnknown_front',
            'parameters.fb_rear_hz.label',
            'parameters.rear_diameter_m.label',
            'parameters.rear_port_count.help',
        ];

        for (const key of keys) {
            expect(portuguese.has(key), `pt-BR ${key}`).toBe(true);
            expect(english.has(key), `en ${key}`).toBe(true);
        }
    });
});
