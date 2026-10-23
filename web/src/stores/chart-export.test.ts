import { beforeEach, describe, expect, test, vi } from 'vite-plus/test';
import { CHART_EXPORT_KEY, useChartExport } from './chart-export';

const DEFAULTS = {
    format: 'png' as const,
    groups: { peak: true, cutoffs: true, box: true, limits: true },
};

beforeEach(() => {
    window.localStorage.clear();
    useChartExport.setState(DEFAULTS);
});

describe('useChartExport', () => {
    test('padrão: PNG com os quatro grupos ligados', () => {
        const { format, groups } = useChartExport.getState();

        expect({ format, groups }).toEqual(DEFAULTS);
    });

    test('guarda formato e grupos na chave do navegador', () => {
        useChartExport.getState().setFormat('pdf');
        useChartExport.getState().setGroup('box', false);

        const saved = JSON.parse(
            window.localStorage.getItem(CHART_EXPORT_KEY) ?? '{}',
        );

        expect(saved.state.format).toBe('pdf');
        expect(saved.state.groups).toEqual({
            peak: true,
            cutoffs: true,
            box: false,
            limits: true,
        });
    });

    test('valor inválido guardado volta ao padrão, campo a campo', async () => {
        window.localStorage.setItem(
            CHART_EXPORT_KEY,
            JSON.stringify({
                state: {
                    format: 'gif',
                    groups: { peak: 'sim', cutoffs: false },
                },
                version: 1,
            }),
        );

        await useChartExport.persist.rehydrate();

        const { format, groups } = useChartExport.getState();

        expect(format).toBe('png');
        expect(groups).toEqual({
            peak: true,
            cutoffs: false,
            box: true,
            limits: true,
        });
    });

    test('localStorage que lança erro não quebra', async () => {
        const blocked = vi
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('bloqueado');
            });

        try {
            await expect(
                useChartExport.persist.rehydrate(),
            ).resolves.not.toThrow();
            expect(useChartExport.getState().format).toBe('png');
        } finally {
            blocked.mockRestore();
        }
    });
});
