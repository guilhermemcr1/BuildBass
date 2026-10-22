import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import {
    NUMERIC_KEYS,
    OPTIONAL_KEYS,
    REQUIRED_KEYS,
    rangeOf,
    toPayload,
    validateSubmission,
} from './schema';
import type { SubmissionForm } from './schema';

const FIXTURE = resolve(
    __dirname,
    '../../../../api/tests/Fixtures/submission-ranges.json',
);

function form(overrides: Partial<SubmissionForm> = {}): SubmissionForm {
    return {
        brand: 'Exemplo',
        model: 'EX-1',
        variant: '',
        type: '',
        source: 'Ficha técnica',
        contact_email: '',
        numbers: { fs_hz: 40, qts: 0.4, vas_m3: 0.05 },
        ...overrides,
    };
}

function errorsOf(value: SubmissionForm) {
    const result = validateSubmission(value);

    return result.ok ? {} : result.errors;
}

describe('faixas espelhadas com o servidor', () => {
    const ranges = Object.fromEntries(
        [...NUMERIC_KEYS]
            .sort()
            .map((key) => [key, [rangeOf(key).min, rangeOf(key).max]]),
    );

    test('a fixture de api/ é igual às faixas do app (SC-005)', () => {
        // UPDATE_RANGES=1 reescreve a fixture depois de mudar uma faixa de PARAMETERS.
        if (process.env.UPDATE_RANGES === '1') {
            writeFileSync(FIXTURE, `${JSON.stringify(ranges, null, 4)}\n`);
        }

        expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(ranges);
    });
});

describe('validateSubmission', () => {
    test('aceita só os obrigatórios', () => {
        expect(validateSubmission(form())).toEqual({ ok: true });
    });

    test.each(['brand', 'model', 'source'] as const)(
        '%s vazio é obrigatório',
        (field) => {
            expect(errorsOf(form({ [field]: '   ' }))[field]).toBe('required');
        },
    );

    test.each(REQUIRED_KEYS)('%s ausente é obrigatório', (key) => {
        const numbers = { ...form().numbers };
        delete numbers[key];

        expect(errorsOf(form({ numbers }))[key]).toBe('required');
    });

    test.each(NUMERIC_KEYS)(
        '%s: limites aceitos, fora da faixa recusado',
        (key) => {
            const { min, max } = rangeOf(key);
            const at = (value: number) =>
                form({ numbers: { ...form().numbers, [key]: value } });

            expect(validateSubmission(at(min)).ok).toBe(true);
            expect(validateSubmission(at(max)).ok).toBe(true);
            expect(
                errorsOf(at(min - Math.max(Math.abs(min) * 0.01, 1e-9)))[key],
            ).toBe('range');
            expect(
                errorsOf(at(max + Math.max(Math.abs(max) * 0.01, 1e-9)))[key],
            ).toBe('range');
        },
    );

    test('opcionais podem faltar', () => {
        expect(OPTIONAL_KEYS).not.toContain('fs_hz');
        expect(validateSubmission(form()).ok).toBe(true);
    });

    test.each([
        ['brand', 80],
        ['model', 80],
        ['variant', 40],
        ['source', 255],
    ] as const)('%s: %i caracteres passam, mais um não', (field, max) => {
        expect(validateSubmission(form({ [field]: 'a'.repeat(max) })).ok).toBe(
            true,
        );
        expect(errorsOf(form({ [field]: 'a'.repeat(max + 1) }))[field]).toBe(
            'tooLong',
        );
    });

    test('e-mail: vazio passa, válido passa, inválido não', () => {
        expect(validateSubmission(form({ contact_email: '' })).ok).toBe(true);
        expect(validateSubmission(form({ contact_email: 'a@b.com' })).ok).toBe(
            true,
        );
        expect(
            errorsOf(form({ contact_email: 'sem-arroba' })).contact_email,
        ).toBe('email');
    });

    test('NaN não é um número válido', () => {
        const numbers = { ...form().numbers, qes: Number.NaN };

        expect(errorsOf(form({ numbers })).qes).toBeDefined();
    });
});

describe('toPayload', () => {
    test('só leva o que foi preenchido, aparado, com locale e a armadilha vazia', () => {
        const payload = toPayload(
            form({
                brand: '  Exemplo ',
                variant: '  ',
                contact_email: '',
                numbers: { fs_hz: 40, qts: 0.4, vas_m3: 0.05, qes: undefined },
            }),
            { locale: 'en' },
        );

        expect(payload).toEqual({
            brand: 'Exemplo',
            model: 'EX-1',
            source: 'Ficha técnica',
            fs_hz: 40,
            qts: 0.4,
            vas_m3: 0.05,
            locale: 'en',
            website: '',
        });
    });

    test('o tipo só vai no envio quando escolhido, e um tipo inválido não passa na validação', () => {
        expect(toPayload(form(), { locale: 'pt-BR' })).not.toHaveProperty(
            'type',
        );
        expect(
            toPayload(form({ type: 'subwoofer' }), { locale: 'pt-BR' }),
        ).toMatchObject({ type: 'subwoofer' });
        expect(
            validateSubmission(
                form({ type: 'tweeter' as SubmissionForm['type'] }),
            ).ok,
        ).toBe(false);
    });

    test('inclui variante, e-mail e token quando existem', () => {
        const payload = toPayload(
            form({ variant: '4 Ω', contact_email: ' a@b.com ' }),
            { locale: 'pt-BR', turnstileToken: 'tok' },
        );

        expect(payload).toMatchObject({
            variant: '4 Ω',
            contact_email: 'a@b.com',
            turnstile_token: 'tok',
        });
    });
});
