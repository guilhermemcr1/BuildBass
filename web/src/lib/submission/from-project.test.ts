import { describe, expect, test } from 'vite-plus/test';
import { emptyForm, formFromProject, hasChanges } from './from-project';

describe('formFromProject', () => {
    test('copia os parâmetros do driver em SI e a origem para a identificação', () => {
        const driver = { fs_hz: 34.5, qts: 0.41, vas_m3: 0.085, xmax_m: 0.008 };
        const form = formFromProject(driver, {
            brand: 'Exemplo',
            model: 'EX-12',
            variant: '4 Ω',
        });

        expect(form).toEqual({
            brand: 'Exemplo',
            model: 'EX-12',
            variant: '4 Ω',
            type: '',
            source: '',
            contact_email: '',
            numbers: { fs_hz: 34.5, qts: 0.41, vas_m3: 0.085, xmax_m: 0.008 },
        });
    });

    test('leva o tipo da identificação para o formulário', () => {
        const form = formFromProject(
            { fs_hz: 40 },
            { brand: 'Exemplo', type: 'midbass' },
        );

        expect(form.type).toBe('midbass');
        expect(form.model).toBe('');
    });

    test('sem origem deixa a identificação em branco', () => {
        const form = formFromProject({ fs_hz: 40 }, undefined);

        expect(form.brand).toBe('');
        expect(form.variant).toBe('');
    });

    test('projeto sem driver abre vazio', () => {
        expect(formFromProject({}, undefined)).toEqual(emptyForm());
    });

    test('não altera o objeto do projeto', () => {
        const driver = { fs_hz: 40, qts: 0.4 };
        const form = formFromProject(driver, undefined);
        form.numbers.fs_hz = 99;

        expect(driver).toEqual({ fs_hz: 40, qts: 0.4 });
    });
});

describe('hasChanges', () => {
    test('detecta alteração em relação ao estado inicial', () => {
        const initial = emptyForm();

        expect(hasChanges(initial, initial)).toBe(false);
        expect(hasChanges({ ...initial, brand: 'x' }, initial)).toBe(true);
    });
});
