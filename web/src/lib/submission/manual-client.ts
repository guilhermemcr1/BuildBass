import { apiUrl } from '@/lib/api';
import { aborted, readBody, retryAfter } from './client';
import { parseManualResponse } from './manual-schema';
import type { ManualResult } from './manual-schema';

// Cliente fino da leitura de manual. Nunca lança: devolve a
// sugestão ou o motivo da falha, e `aborted` quando a própria interface cancelou o pedido.

export const MANUAL_MAX_BYTES = 10 * 1024 * 1024;

export type ManualError =
    | 'network'
    | 'server'
    | 'unreadable'
    | 'invalidFile'
    | 'notPdf'
    | 'tooLarge'
    | 'rateLimited'
    | 'unavailable'
    | 'providerFailed'
    | 'verification'
    // Texto colado: vazio, longo demais ou sem nenhuma linha com parâmetro.
    | 'invalidText'
    | 'noParameters';

export type ManualFillResult =
    | { ok: true; result: ManualResult }
    | { ok: false; error: ManualError; retryAfterS?: number; aborted?: false }
    | { ok: false; aborted: true };

type ManualRequest = {
    locale: 'pt-BR' | 'en';
    // Campo-armadilha: o usuário nunca o preenche.
    trap: string;
    turnstileToken?: string;
};

function invalidFileError(body: Record<string, unknown>): ManualError {
    const errors = body.errors as { manual?: unknown } | undefined;
    const reason = Array.isArray(errors?.manual) ? errors.manual[0] : undefined;

    if (reason === 'not_pdf') {
        return 'notPdf';
    }

    return reason === 'too_large' ? 'tooLarge' : 'invalidFile';
}

export async function extractManual(
    file: File,
    request: ManualRequest,
    signal?: AbortSignal,
): Promise<ManualFillResult> {
    const body = new FormData();
    body.append('manual', file);

    return post('/api/driver-submissions/extract', body, request, signal);
}

// Mesmos limites do servidor (config/manual_extraction.php → text_max_input).
export const MANUAL_TEXT_MAX_CHARS = 4000;
export const MANUAL_TEXT_MIN_CHARS = 10;

// Texto colado com os parâmetros: o chamador já manda só as linhas filtradas
// (lib/assistant/text-filter.ts); o servidor filtra de novo antes da IA.
export async function extractManualText(
    text: string,
    request: ManualRequest,
    signal?: AbortSignal,
): Promise<ManualFillResult> {
    const body = new FormData();
    body.append('text', text.slice(0, MANUAL_TEXT_MAX_CHARS));

    return post('/api/driver-submissions/extract-text', body, request, signal);
}

async function post(
    path: string,
    body: FormData,
    request: ManualRequest,
    signal?: AbortSignal,
): Promise<ManualFillResult> {
    body.append('locale', request.locale);
    body.append('website', request.trap);

    if (request.turnstileToken !== undefined) {
        body.append('turnstile_token', request.turnstileToken);
    }

    let response: Response;

    try {
        response = await fetch(apiUrl(path), {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body,
            signal,
        });
    } catch (error) {
        return aborted(error)
            ? { ok: false, aborted: true }
            : { ok: false, error: 'network' };
    }

    const content = await readBody(response);

    if (response.status === 200) {
        const result = parseManualResponse(content);

        return result === undefined
            ? { ok: false, error: 'server' }
            : { ok: true, result };
    }

    if (response.status === 429) {
        return {
            ok: false,
            error: 'rateLimited',
            retryAfterS: retryAfter(response),
        };
    }

    if (response.status === 503) {
        return { ok: false, error: 'unavailable' };
    }

    if (response.status === 502) {
        return { ok: false, error: 'providerFailed' };
    }

    if (response.status === 422) {
        if (content.code === 'verification_failed') {
            return { ok: false, error: 'verification' };
        }

        if (content.code === 'unreadable') {
            return { ok: false, error: 'unreadable' };
        }

        if (content.code === 'no_parameters') {
            return { ok: false, error: 'noParameters' };
        }

        if (content.code === 'invalid_file') {
            return { ok: false, error: invalidFileError(content) };
        }

        if (
            (content.errors as { text?: unknown } | undefined)?.text !==
            undefined
        ) {
            return { ok: false, error: 'invalidText' };
        }
    }

    return { ok: false, error: 'server' };
}
