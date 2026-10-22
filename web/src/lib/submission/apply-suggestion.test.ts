import { describe, expect, test } from 'vite-plus/test';
import { applySuggestion } from './apply-suggestion';
import { emptyForm } from './from-project';
import type { ManualSuggestion } from './manual-schema';

const SUGGESTION: ManualSuggestion = {
    brand: 'Triton',
    model: 'TR 620',
    variant: '4 Ω',
    type: 'woofer',
    numbers: { fs_hz: 76.94, qts: 0.717, vas_m3: 0.026348 },
};

describe('applySuggestion', () => {
    test('preenche todos os campos vazios', () => {
        const { form, filled } = applySuggestion(emptyForm(), SUGGESTION);

        expect(form.brand).toBe('Triton');
        expect(form.model).toBe('TR 620');
        expect(form.variant).toBe('4 Ω');
        expect(form.type).toBe('woofer');
        expect(form.numbers).toEqual(SUGGESTION.numbers);
        expect(filled).toEqual([
            'brand',
            'model',
            'variant',
            'fs_hz',
            'qts',
            'vas_m3',
        ]);
    });

    test('mantém o que a pessoa já digitou ou escolheu', () => {
        const typed = {
            ...emptyForm(),
            brand: 'Minha marca',
            type: 'subwoofer' as const,
            numbers: { qts: 0.5 },
        };
        const { form, filled } = applySuggestion(typed, SUGGESTION);

        expect(form.brand).toBe('Minha marca');
        expect(form.type).toBe('subwoofer');
        expect(form.numbers.qts).toBe(0.5);
        expect(form.numbers.fs_hz).toBe(76.94);
        expect(filled).not.toContain('brand');
        expect(filled).not.toContain('qts');
    });

    test('texto só com espaços conta como vazio', () => {
        const { form } = applySuggestion(
            { ...emptyForm(), model: '   ' },
            SUGGESTION,
        );

        expect(form.model).toBe('TR 620');
    });

    test('campo ausente na sugestão não escreve nada', () => {
        const { form, filled } = applySuggestion(emptyForm(), {
            numbers: { fs_hz: 40 },
        });

        expect(form.brand).toBe('');
        expect(form.type).toBe('');
        expect(form.numbers).toEqual({ fs_hz: 40 });
        expect(filled).toEqual(['fs_hz']);
    });

    test('nunca toca a fonte dos dados nem o e-mail', () => {
        const typed = {
            ...emptyForm(),
            source: 'Minha ficha',
            contact_email: 'a@b.com',
        };
        const { form } = applySuggestion(typed, SUGGESTION);

        expect(form.source).toBe('Minha ficha');
        expect(form.contact_email).toBe('a@b.com');
    });

    test('limpar um campo e aplicar de novo o preenche', () => {
        const first = applySuggestion(emptyForm(), SUGGESTION).form;
        const cleared = { ...first, numbers: { ...first.numbers } };
        delete cleared.numbers.qts;

        const { form } = applySuggestion(cleared, SUGGESTION);

        expect(form.numbers.qts).toBe(0.717);
    });

    test('não altera o formulário recebido', () => {
        const original = emptyForm();
        applySuggestion(original, SUGGESTION);

        expect(original).toEqual(emptyForm());
    });
});
