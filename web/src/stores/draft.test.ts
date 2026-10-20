import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { useDraft } from './draft';
import { usePreferences } from './preferences';

describe('rascunho da bancada', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
        useDraft.getState().reset();
    });

    test('trocar a unidade de um campo não altera o valor SI', () => {
        useDraft.getState().setValue('vas_m3', 0.085);
        useDraft.getState().setFieldUnit('vas_m3', 'ft3');

        expect(useDraft.getState().values.vas_m3).toBe(0.085);
        expect(useDraft.getState().fieldUnits.vas_m3).toBe('ft3');
    });

    test('trocar o sistema global limpa as unidades por campo e mantém os valores', () => {
        useDraft.getState().setValue('xmax_m', 0.012);
        useDraft.getState().setFieldUnit('xmax_m', 'cm');

        usePreferences.getState().setUnitSystem('imperial');

        expect(useDraft.getState().fieldUnits).toEqual({});
        expect(useDraft.getState().values.xmax_m).toBe(0.012);
    });
});
