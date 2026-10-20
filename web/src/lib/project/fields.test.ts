import { expect, test } from 'vite-plus/test';
import type { ParameterKey } from '@/lib/parameters';
import { readField, writeField } from './fields';
import { createProjectData } from './types';

test('cada campo da bancada é lido e escrito no lugar certo do projeto', () => {
    const cases: [ParameterKey, number][] = [
        ['fs_hz', 28],
        ['vd_m3', 0.002],
        ['vb_m3', 0.05],
        ['fb_hz', 32],
        ['ql', 10],
        ['diameter_m', 0.08],
        ['port_count', 2],
        ['driver_count', 3],
        ['power_w', 100],
        ['voltage_v', 2.83],
    ];

    for (const [key, value] of cases) {
        const data = writeField(createProjectData(''), key, value);
        expect(readField(data, key), key).toBe(value);
    }
});

test('apagar um campo remove o valor digitado', () => {
    const data = writeField(createProjectData(''), 'fs_hz', 28);

    expect('fs_hz' in writeField(data, 'fs_hz', undefined).driver).toBe(false);
    expect(writeField(data, 'ql', undefined).box.ql).toBe(7);
});
