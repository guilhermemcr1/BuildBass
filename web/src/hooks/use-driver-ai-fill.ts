import { useEffect, useRef, useState } from 'react';
import { activeProjectStore } from '@/hooks/use-active-project';
import { useOnlineStatus } from '@/hooks/use-online-status';
import {
    applyManualToProject,
    withoutDriver,
} from '@/lib/assistant/apply-manual';
import { filterParameterText } from '@/lib/assistant/text-filter';
import {
    extractManual,
    extractManualText,
} from '@/lib/submission/manual-client';
import type { ManualFillResult } from '@/lib/submission/manual-client';
import type { ManualFailure } from '@/hooks/use-submit-driver';
import type { ManualWarning } from '@/lib/submission/manual-schema';
import type { NumericKey } from '@/lib/submission/schema';
import { getTurnstileToken } from '@/lib/submission/turnstile';
import { usePreferences } from '@/stores/preferences';

export type AiFillState =
    | { status: 'idle' }
    | { status: 'reading'; source: 'pdf' | 'text' }
    | { status: 'failed'; failure: ManualFailure }
    | {
          status: 'done';
          filled: NumericKey[];
          suspect: NumericKey[];
          discarded: NumericKey[];
          warnings: ManualWarning[];
      };

export type DriverAiFill = {
    state: AiFillState;
    offline: boolean;
    // A leitura por IA está desligada no servidor: as opções somem até recarregar a página.
    unavailable: boolean;
    fromPdf: (file: File) => Promise<void>;
    fromText: (text: string) => Promise<void>;
    reset: () => void;
};

// Leitura por IA no assistente: o PDF do manual ou o texto colado viram valores no projeto ativo,
// só nos campos vazios e numa etapa só de desfazer. O texto passa antes pelo filtro local, que manda
// só as linhas com parâmetro (o servidor filtra de novo).
export function useDriverAiFill(): DriverAiFill {
    const offline = useOnlineStatus() === 'offline';
    const [state, setState] = useState<AiFillState>({ status: 'idle' });
    const [unavailable, setUnavailable] = useState(false);
    const controller = useRef<AbortController | undefined>(undefined);
    const locale = usePreferences((state) => state.locale);

    useEffect(() => () => controller.current?.abort(), []);

    async function run(
        source: 'pdf' | 'text',
        request: (
            token: string | undefined,
            signal: AbortSignal,
        ) => Promise<ManualFillResult>,
    ): Promise<void> {
        if (state.status === 'reading' || unavailable || offline) {
            return;
        }

        setState({ status: 'reading', source });
        controller.current = new AbortController();
        const captcha = await getTurnstileToken();

        if (!captcha.ok) {
            setState({
                status: 'failed',
                failure: { error: 'verification' },
            });
            return;
        }

        const result = await request(captcha.token, controller.current.signal);

        if (!result.ok && result.aborted === true) {
            return;
        }

        if (!result.ok) {
            setUnavailable(result.error === 'unavailable');
            setState({
                status: 'failed',
                failure: {
                    error: result.error,
                    retryAfterS: result.retryAfterS,
                },
            });
            return;
        }

        let filled: NumericKey[] = [];

        activeProjectStore()
            .getState()
            .apply((data) => {
                // O manual lido é de outro alto-falante (ou do mesmo, revisado): substitui o
                // anterior por inteiro. Desfazer (Ctrl+Z) traz os dados antigos de volta.
                const applied = applyManualToProject(
                    withoutDriver(data),
                    result.result.suggestion,
                );
                filled = applied.filled;

                return applied.data;
            });

        setState({
            status: 'done',
            filled,
            suspect: result.result.suspect.filter((key) =>
                filled.includes(key),
            ),
            discarded: result.result.discarded,
            warnings: result.result.warnings,
        });
    }

    return {
        state,
        offline,
        unavailable,
        fromPdf: (file) =>
            run('pdf', (token, signal) =>
                extractManual(
                    file,
                    { locale, trap: '', turnstileToken: token },
                    signal,
                ),
            ),
        fromText: async (raw) => {
            const filtered = filterParameterText(raw);

            // Sem linha de parâmetro, nem chega ao servidor (não gasta cota).
            if (filtered.relevant === 0) {
                setState({
                    status: 'failed',
                    failure: { error: 'noParameters' },
                });
                return;
            }

            await run('text', (token, signal) =>
                extractManualText(
                    filtered.text,
                    { locale, trap: '', turnstileToken: token },
                    signal,
                ),
            );
        },
        reset: () => {
            controller.current?.abort();
            setState({ status: 'idle' });
        },
    };
}
