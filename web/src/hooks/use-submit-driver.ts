import { useRef, useState } from 'react';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { applySuggestion } from '@/lib/submission/apply-suggestion';
import { syncDerived, withoutAuto } from '@/lib/submission/auto-derive';
import type { AutoKeys } from '@/lib/submission/auto-derive';
import { submitDriver } from '@/lib/submission/client';
import type { SubmitError } from '@/lib/submission/client';
import { hasChanges } from '@/lib/submission/from-project';
import { extractManual } from '@/lib/submission/manual-client';
import type { ManualError } from '@/lib/submission/manual-client';
import type { ManualWarning } from '@/lib/submission/manual-schema';
import { toPayload, validateSubmission } from '@/lib/submission/schema';
import type {
    NumericKey,
    SubmissionErrors,
    SubmissionForm,
} from '@/lib/submission/schema';
import { getTurnstileToken } from '@/lib/submission/turnstile';
import { usePreferences } from '@/stores/preferences';

export type SubmitStatus = 'editing' | 'sending' | 'done';

export type SubmitFailure = { error: SubmitError; retryAfterS?: number };

export type ManualFailure = { error: ManualError; retryAfterS?: number };

// Leitura de manual (specs/009): só pré-preenche o formulário; nunca envia nada ao catálogo.
export type ManualState = {
    status: 'idle' | 'reading' | 'done' | 'failed';
    // Quantos campos vazios receberam valor na última leitura.
    filled: number;
    // Campos preenchidos que não fecham com os demais; o destaque sai quando a pessoa edita.
    suspect: NumericKey[];
    discarded: NumericKey[];
    warnings: ManualWarning[];
    failure?: ManualFailure;
    // O servidor disse que o recurso está fora do ar: o botão fica travado até fechar o diálogo.
    unavailable: boolean;
};

const MANUAL_IDLE: ManualState = {
    status: 'idle',
    filled: 0,
    suspect: [],
    discarded: [],
    warnings: [],
    unavailable: false,
};

// Estado do envio de driver (specs/006): o formulário vive aqui, então uma falha nunca perde o
// que foi digitado (FR-020).
export function useSubmitDriver(initial: SubmissionForm) {
    const locale = usePreferences((state) => state.locale);
    const offline = useOnlineStatus() === 'offline';
    // O que parte do projeto já chega com os campos calculados inseridos; o "inicial" para saber se
    // há alterações é esse mesmo, para o cálculo sozinho não contar como edição.
    const [start] = useState(() => syncDerived(initial, new Set()));
    const [form, setFormState] = useState(start.form);
    // Campos cujo valor foi calculado dos outros (e não digitado): recalculam sozinhos.
    const [auto, setAuto] = useState<AutoKeys>(start.auto);
    // O formulário mais recente, para a leitura do manual não aplicar sobre um valor já velho.
    const formRef = useRef(form);
    formRef.current = form;
    const autoRef = useRef(auto);
    autoRef.current = auto;
    const [manual, setManual] = useState<ManualState>(MANUAL_IDLE);
    const manualController = useRef<AbortController | undefined>(undefined);
    // Campo-armadilha (FR-011): visível só para robôs.
    const [trap, setTrap] = useState('');
    const [errors, setErrors] = useState<SubmissionErrors>({});
    const [status, setStatus] = useState<SubmitStatus>('editing');
    const [failure, setFailure] = useState<SubmitFailure | undefined>();
    const [protocol, setProtocol] = useState<string | undefined>();
    const controller = useRef<AbortController | undefined>(undefined);

    // Editar um campo destacado como suspeito tira o destaque daquele campo.
    function setForm(next: SubmissionForm): void {
        // O que a pessoa mexeu deixa de ser "calculado": passa a valer o que ela digitou.
        const edited = new Set(
            [...auto].filter((key) => next.numbers[key] !== form.numbers[key]),
        );
        const synced = syncDerived(
            next,
            new Set([...auto].filter((key) => !edited.has(key))),
        );

        setFormState(synced.form);
        setAuto(synced.auto);
        setManual((current) =>
            current.suspect.length === 0
                ? current
                : {
                      ...current,
                      suspect: current.suspect.filter(
                          (key) =>
                              synced.form.numbers[key] === form.numbers[key],
                      ),
                  },
        );
    }

    async function fillFromManual(file: File): Promise<void> {
        if (manual.status === 'reading' || manual.unavailable || offline) {
            return;
        }

        setManual({ ...MANUAL_IDLE, status: 'reading' });
        manualController.current = new AbortController();

        const captcha = await getTurnstileToken();

        if (!captcha.ok) {
            setManual({
                ...MANUAL_IDLE,
                status: 'failed',
                failure: { error: 'verification' },
            });
            return;
        }

        const result = await extractManual(
            file,
            { locale, trap, turnstileToken: captcha.token },
            manualController.current.signal,
        );

        if (!result.ok && result.aborted === true) {
            return;
        }

        if (!result.ok) {
            setManual({
                ...MANUAL_IDLE,
                status: 'failed',
                failure: {
                    error: result.error,
                    retryAfterS: result.retryAfterS,
                },
                unavailable: result.error === 'unavailable',
            });
            return;
        }

        // Valor calculado não segura o lugar do que o manual traz: parte do que foi digitado.
        const applied = applySuggestion(
            withoutAuto(formRef.current, autoRef.current),
            result.result.suggestion,
        );
        const synced = syncDerived(applied.form, new Set());

        setFormState(synced.form);
        setAuto(synced.auto);
        setManual({
            status: 'done',
            filled: applied.filled.length,
            suspect: result.result.suspect.filter((key) =>
                applied.filled.includes(key),
            ),
            discarded: result.result.discarded,
            warnings: result.result.warnings,
            unavailable: false,
        });
    }

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
        manual,
        fillFromManual,
        offline,
        auto,
        dirty: hasChanges(form, start.form),
        submit,
        abort: () => {
            controller.current?.abort();
            manualController.current?.abort();
        },
    };
}
