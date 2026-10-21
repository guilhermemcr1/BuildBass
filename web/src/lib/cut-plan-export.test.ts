import { afterEach, describe, expect, test, vi } from 'vite-plus/test';
import { initI18n } from '@/i18n';
import type { Locale } from '@/i18n';
import type { Plan } from '@/cutplan';
import {
    csvFormatFor,
    cutPlanFileName,
    downloadCutPlanCsv,
} from './cut-plan-export';

const PLAN: Plan = {
    boxType: 'closed',
    thickness_m: 0.018,
    dimensions: {
        internal: { w_m: 0.4, h_m: 0.6, d_m: 0.25 },
        external: { w_m: 0.436, h_m: 0.636, d_m: 0.286 },
    },
    pieces: [
        {
            role: 'front',
            quantity: 1,
            w_m: 0.436,
            h_m: 0.636,
            thickness_m: 0.018,
            cutouts: [{ kind: 'driver', shape: 'round', diameter_m: 0.285 }],
        },
    ],
    volume: { chambers: [] },
    warnings: [],
};

async function i18nIn(locale: Locale) {
    const instance = initI18n(locale);
    await instance.changeLanguage(locale);

    return instance;
}

describe('csvFormatFor', () => {
    test('pt-BR métrico: vírgula decimal, mm com 1 casa, L com 1 casa', async () => {
        const i18n = await i18nIn('pt-BR');
        const format = csvFormatFor('pt-BR', 'metric', i18n.t);

        expect(format.decimalSeparator).toBe(',');
        expect(format.unitSymbol).toBe('mm');
        expect(format.volumeSymbol).toBe('L');
        expect(format.number(0.4365)).toBe('436,5');
        expect(format.volume(0.0605)).toBe('60,5');
        expect(format.labels.columns.piece).toBe('Peça');
        expect(format.labels.pieces.divider).toBe('Divisória');
    });

    test('sem separador de milhar mesmo em medidas grandes', async () => {
        const i18n = await i18nIn('pt-BR');
        const format = csvFormatFor('pt-BR', 'metric', i18n.t);

        expect(format.number(1.2345)).toBe('1234,5');
    });

    test('en imperial: ponto decimal, polegadas com 3 casas, ft³ com 2', async () => {
        const i18n = await i18nIn('en');
        const format = csvFormatFor('en', 'imperial', i18n.t);

        expect(format.decimalSeparator).toBe('.');
        expect(format.unitSymbol).toBe('in');
        expect(format.volumeSymbol).toBe('ft³');
        expect(format.number(0.0254)).toBe('1.000');
        expect(format.volume(0.0283168)).toBe('1.00');
        expect(format.labels.columns.piece).toBe('Piece');
    });

    test('os recortes saem em texto na unidade ativa', async () => {
        const i18n = await i18nIn('pt-BR');
        const format = csvFormatFor('pt-BR', 'metric', i18n.t);

        expect(format.cutouts(PLAN.pieces[0].cutouts)).toEqual([
            'Driver Ø 285,0 mm',
        ]);
    });
});

describe('arquivo do CSV', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('nome do arquivo usa o nome do projeto sem acentos', () => {
        expect(cutPlanFileName('Sub 12" dutado')).toBe(
            'sub-12-dutado-plano-de-corte.csv',
        );
        expect(cutPlanFileName('')).toBe('projeto-plano-de-corte.csv');
    });

    test('baixa um Blob text/csv com o nome certo', async () => {
        const i18n = await i18nIn('pt-BR');
        const blobs: Blob[] = [];
        const created = vi
            .spyOn(URL, 'createObjectURL')
            .mockImplementation((blob) => {
                blobs.push(blob as Blob);

                return 'blob:test';
            });
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
        const click = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(function (this: HTMLAnchorElement) {
                expect(this.download).toBe('caixa-onix-plano-de-corte.csv');
            });

        downloadCutPlanCsv(
            PLAN,
            'Caixa Ônix',
            csvFormatFor('pt-BR', 'metric', i18n.t),
        );

        expect(created).toHaveBeenCalledTimes(1);
        expect(click).toHaveBeenCalledTimes(1);
        expect(blobs[0].type).toBe('text/csv;charset=utf-8');
        expect(await blobs[0].text()).toContain('Frente');
    });
});
