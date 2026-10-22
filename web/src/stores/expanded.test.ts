import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { sectionOf } from '@/lib/parameters';
import { useExpanded } from './expanded';
import { PREFERENCES_KEY, usePreferences } from './preferences';

describe('seções "Mostrar mais" — estado de expansão', () => {
    beforeEach(() => {
        window.localStorage.clear();
        usePreferences.setState({ mode: 'normal' });
        useExpanded.getState().collapseAll();
    });

    test('começa tudo recolhido no Normal', () => {
        expect(useExpanded.getState().open).toEqual({
            driverAdvanced: false,
            planAdvanced: false,
        });
    });

    test('virar Pro expande tudo e voltar ao Normal recolhe tudo', () => {
        usePreferences.getState().setMode('pro');

        expect(useExpanded.getState().open).toEqual({
            driverAdvanced: true,
            planAdvanced: true,
        });

        usePreferences.getState().setMode('normal');

        expect(useExpanded.getState().open).toEqual({
            driverAdvanced: false,
            planAdvanced: false,
        });
    });

    test('toggle e expand mexem só na seção pedida, sem mudar o modo', () => {
        useExpanded.getState().toggle('driverAdvanced');

        expect(useExpanded.getState().open).toEqual({
            driverAdvanced: true,
            planAdvanced: false,
        });

        useExpanded.getState().toggle('driverAdvanced');
        useExpanded.getState().expand('planAdvanced');

        expect(useExpanded.getState().open).toEqual({
            driverAdvanced: false,
            planAdvanced: true,
        });
        expect(usePreferences.getState().mode).toBe('normal');
    });

    test('a expansão não é persistida, só o modo', () => {
        useExpanded.getState().expand('driverAdvanced');
        usePreferences.getState().setMode('pro');

        const stored = window.localStorage.getItem(PREFERENCES_KEY) ?? '';

        expect(stored).toContain('"mode":"pro"');
        expect(stored).not.toContain('driverAdvanced');
        expect(window.localStorage.length).toBe(1);
    });

    test('abrir uma seção à mão com o modo Pro já ativo não recolhe as outras', () => {
        usePreferences.getState().setMode('pro');
        useExpanded.getState().toggle('planAdvanced');

        expect(useExpanded.getState().open).toEqual({
            driverAdvanced: true,
            planAdvanced: false,
        });
    });
});

describe('sectionOf', () => {
    test('campos do driver não essenciais ficam em driverAdvanced', () => {
        for (const key of [
            'qes',
            'qms',
            're_ohm',
            'le_h',
            'bl_tm',
            'mms_kg',
            'vd_m3',
        ] as const) {
            expect(sectionOf(key)).toBe('driverAdvanced');
        }
    });

    test('reforços e perda de serra ficam em planAdvanced', () => {
        expect(sectionOf('braces_m3')).toBe('planAdvanced');
        expect(sectionOf('kerf_m')).toBe('planAdvanced');
    });

    test('essenciais e demais campos ficam sempre à vista', () => {
        for (const key of [
            'fs_hz',
            'qts',
            'vas_m3',
            'sd_m2',
            'xmax_m',
            'pe_w',
            'vb_m3',
            'thickness_m',
            'cutout_m',
        ] as const) {
            expect(sectionOf(key)).toBeUndefined();
        }
    });
});
