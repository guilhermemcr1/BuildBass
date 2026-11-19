import type { TFunction } from 'i18next';
import { describe, expect, test } from 'vite-plus/test';
import type { Cutout } from '@/cutplan/types';
import { cutoutSummary } from './cut-plan-text';

// Tradução de mentira: devolve a chave com os parâmetros, para o teste ler a estrutura.
const t = ((key: string, params?: Record<string, unknown>) =>
    params === undefined
        ? key
        : `${key}(${Object.values(params).join(',')})`) as unknown as TFunction;
const text = { t, length: (m: number) => `${m * 1000}mm` };

describe('cutoutSummary', () => {
    test('dutos triangulares nos quatro cantos viram uma linha com a quantidade', () => {
        const corners = [
            'bottomLeft',
            'bottomRight',
            'topLeft',
            'topRight',
        ] as const;
        const cutouts: Cutout[] = [
            { kind: 'driver', shape: 'round', diameter_m: 0.282 },
            ...corners.map((corner, index): Cutout => ({
                kind: 'port',
                shape: 'triangle',
                base_m: 0.12,
                height_m: 0.1,
                corner,
                rotation_deg: index === 0 ? undefined : 90,
                ref: { piece: 'front', kind: 'port', n: index + 1 },
                center: { x_m: index, y_m: index },
            })),
        ];

        const lines = cutoutSummary(cutouts, text);

        expect(lines).toHaveLength(2);
        expect(lines[1]).toContain('cutplan:cutouts.count(4)');
    });

    test('medidas diferentes continuam separadas', () => {
        const lines = cutoutSummary(
            [
                { kind: 'port', shape: 'round', diameter_m: 0.1 },
                { kind: 'port', shape: 'round', diameter_m: 0.075 },
            ],
            text,
        );

        expect(lines).toHaveLength(2);
    });
});
