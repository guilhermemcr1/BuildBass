import { useRef, useState } from 'react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { submitDriver } from '@/lib/submission/client';
import type { SubmitError } from '@/lib/submission/client';
import { hasChanges } from '@/lib/submission/from-project';
import { toPayload, validateSubmission } from '@/lib/submission/schema';
import type { SubmissionErrors, SubmissionForm } from '@/lib/submission/schema';
import { getTurnstileToken } from '@/lib/submission/turnstile';
import { usePreferences } from '@/stores/preferences';

export type SubmitStatus = 'editing' | 'sending' | 'done';

export type SubmitFailure = { error: SubmitError; retryAfterS?: number };

// Estado do envio de driver (specs/006): o formulário vive aqui, então uma falha nunca perde o
// que foi digitado (FR-020).
export function useSubmitDriver(initial: SubmissionForm) {
    const locale = usePreferences((state) => state.locale);
    const offline = useOnlineStatus() === 'offline';
    const [form, setForm] = useState(initial);
    // Campo-armadilha (FR-011): visível só para robôs.
    const [trap, setTrap] = useState('');
    const [errors, setErrors] = useState<SubmissionErrors>({});
    const [status, setStatus] = useState<SubmitStatus>('editing');
    const [failure, setFailure] = useState<SubmitFailure | undefined>();
    const [protocol, setProtocol] = useState<string | undefined>();
    const [sentEmail, setSentEmail] = useState(false);
    const controller = useRef<AbortController | undefined>(undefined);

    async function submit(): Promise<void> {
        if (status === 'sending' || offline) {
            return;
        }

        const validation = validateSubmission(form);

        if (!validation.ok) {
            setErrors(validation.errors);
            setFailure(undefined);
            return;
        }

        setErrors({});
        setFailure(undefined);
        setStatus('sending');
        controller.current = new AbortController();

        // Verificação anti-robô invisível (FR-011): um token novo a cada tentativa.
        const captcha = await getTurnstileToken();

        if (!captcha.ok) {
            setStatus('editing');
            setFailure({ error: 'verification' });
            return;
        }

        const result = await submitDriver(
            {
                ...toPayload(form, {
                    locale,
                    turnstileToken: captcha.token,
                }),
                website: trap,
            },
            controller.current.signal,
        );

        if (!result.ok && result.aborted === true) {
            return;
        }

        if (result.ok) {
            setProtocol(result.protocol);
            setSentEmail(form.contact_email.trim() !== '');
            setStatus('done');
            return;
        }

        setStatus('editing');
        setFailure({ error: result.error, retryAfterS: result.retryAfterS });

        // O servidor recusou campos que o app aceitou: mostra os avisos nos campos.
        if (result.error === 'invalid' && result.fieldErrors !== undefined) {
            const fromServer: SubmissionErrors = {};

            for (const field of Object.keys(result.fieldErrors)) {
                fromServer[field as keyof SubmissionErrors] = 'range';
            }

            setErrors(fromServer);
        }
    }

    return {
        form,
        setForm,
        trap,
        setTrap,
        errors,
        status,
        failure,
        protocol,
        sentEmail,
        offline,
        dirty: hasChanges(form, initial),
        submit,
        abort: () => controller.current?.abort(),
    };
}
