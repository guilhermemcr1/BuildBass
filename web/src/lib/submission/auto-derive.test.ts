import { describe, expect, test } from 'vite-plus/test';
import { NO_AUTO, syncDerived, withoutAuto } from './auto-derive';
import type { SubmissionForm } from './schema';

function form(numbers: SubmissionForm['numbers']): SubmissionForm {
    return {
        brand: '',
        model: '',
        variant: '',
        type: '',
        source: '',
        contact_email: '',
        numbers,
        shape: '',
        piston: '',
        dims: {},
    };
}

describe('syncDerived — campos que se preenchem sozinhos', () => {
    test('Qes e Qms preenchem o Qts, marcado como calculado', () => {
        const result = syncDerived(form({ qes: 0.44, qms: 8.37 }), NO_AUTO);

        expect(result.form.numbers.qts).toBeCloseTo(0.418, 3);
        expect([...result.auto]).toEqual(['qts']);
    });

    test('o que foi digitado nunca é sobrescrito', () => {
        const result = syncDerived(
            form({ qes: 0.44, qms: 8.37, qts: 0.5 }),
            NO_AUTO,
        );

        expect(result.form.numbers.qts).toBe(0.5);
        expect(result.auto.size).toBe(0);
    });

    test('o calculado se atualiza quando a origem muda e some quando não dá mais para calcular', () => {
        const first = syncDerived(form({ qes: 0.44, qms: 8.37 }), NO_AUTO);
        const changed = syncDerived(
            { ...first.form, numbers: { ...first.form.numbers, qms: 4 } },
            first.auto,
        );

        expect(changed.form.numbers.qts).toBeCloseTo(0.3964, 3);

        const { qms: _removed, ...rest } = changed.form.numbers;
        const cleared = syncDerived(
            { ...changed.form, numbers: rest },
            changed.auto,
        );

        expect(cleared.form.numbers.qts).toBeUndefined();
        expect(cleared.auto.size).toBe(0);
    });

    test('Cms (de Fs e Mms) e Sd preenchem o Vas', () => {
        const result = syncDerived(
            form({ fs_hz: 28.93, mms_kg: 0.15476, sd_m2: 0.04 }),
            NO_AUTO,
        );

        // Vas = Cms·ρ·c²·Sd², com Cms = 1/((2π·Fs)²·Mms)
        expect(result.form.numbers.vas_m3).toBeCloseTo(0.04437, 4);
        expect(result.auto.has('vas_m3')).toBe(true);
    });

    test('resultado fora da faixa do campo não é inserido', () => {
        const result = syncDerived(form({ qes: 0.06, qms: 0.1 }), NO_AUTO);

        expect(result.form.numbers.qts).toBeUndefined();
    });

    test('withoutAuto devolve só o digitado', () => {
        const synced = syncDerived(form({ qes: 0.44, qms: 8.37 }), NO_AUTO);

        expect(withoutAuto(synced.form, synced.auto).numbers).toEqual({
            qes: 0.44,
            qms: 8.37,
        });
    });
});
