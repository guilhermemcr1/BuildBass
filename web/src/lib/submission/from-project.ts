import type { SubmissionForm } from './schema';

export function emptyForm(): SubmissionForm {
    return {
        brand: '',
        model: '',
        variant: '',
        type: '',
        source: '',
        contact_email: '',
        numbers: {},
        shape: '',
        piston: '',
        dims: {},
    };
}

// Há algo digitado que se perderia ao fechar? (comparado com o estado inicial)
export function hasChanges(
    current: SubmissionForm,
    initial: SubmissionForm,
): boolean {
    return JSON.stringify(current) !== JSON.stringify(initial);
}
