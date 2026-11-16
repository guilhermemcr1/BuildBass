import { NUMERIC_KEYS } from './schema';
import type { SubmissionFieldId, SubmissionForm } from './schema';
import type { ManualSuggestion } from './manual-schema';

const TEXT_FIELDS = ['brand', 'model', 'variant'] as const;

// Aplica a sugestão da leitura de manual: só campos vazios recebem valor. O
// que a pessoa digitou ou escolheu nunca é sobrescrito, e `source` e `contact_email` não entram:
// a origem dos dados e o contato continuam sendo dela.
export function applySuggestion(
    form: SubmissionForm,
    suggestion: ManualSuggestion,
): { form: SubmissionForm; filled: SubmissionFieldId[] } {
    const next: SubmissionForm = { ...form, numbers: { ...form.numbers } };
    const filled: SubmissionFieldId[] = [];

    for (const field of TEXT_FIELDS) {
        const value = suggestion[field];

        if (value !== undefined && form[field].trim() === '') {
            next[field] = value;
            filled.push(field);
        }
    }

    if (suggestion.type !== undefined && form.type === '') {
        next.type = suggestion.type;
    }

    for (const key of NUMERIC_KEYS) {
        const value = suggestion.numbers[key];

        if (value !== undefined && form.numbers[key] === undefined) {
            next.numbers[key] = value;
            filled.push(key);
        }
    }

    return { form: next, filled };
}
