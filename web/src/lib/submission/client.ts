import { apiUrl } from '@/lib/api';
import { submissionResponseSchema } from './schema';
import type { SubmissionPayload } from './schema';

// Cliente fino do envio de driver. Nunca lança: devolve
// o protocolo ou o motivo da falha, e `aborted` quando a própria interface cancelou o pedido.

export type SubmitError =
    | 'network'
    | 'server'
    | 'invalid'
    | 'rateLimited'
    | 'verification'
    | 'alreadyInCatalog'
    | 'alreadyPending';

export type SubmitResult =
    | { ok: true; protocol: string }
    | {
          ok: false;
          error: SubmitError;
          retryAfterS?: number;
          fieldErrors?: Record<string, string[]>;
          aborted?: false;
      }
    | { ok: false; aborted: true };

export function aborted(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}

export async function readBody(
    response: Response,
): Promise<Record<string, unknown>> {
    try {
        const body: unknown = await response.json();

        return typeof body === 'object' && body !== null
            ? (body as Record<string, unknown>)
            : {};
    } catch {
        return {};
    }
}

export function retryAfter(response: Response): number | undefined {
    const seconds = Number(response.headers.get('Retry-After'));

    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

function fieldErrorsOf(
    body: Record<string, unknown>,
): Record<string, string[]> | undefined {
    const errors = body.errors;

    return typeof errors === 'object' && errors !== null
        ? (errors as Record<string, string[]>)
        : undefined;
}

export async function submitDriver(
    payload: SubmissionPayload,
    signal?: AbortSignal,
): Promise<SubmitResult> {
    let response: Response;

    try {
        response = await fetch(apiUrl('/api/driver-submissions'), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal,
        });
    } catch (error) {
        return aborted(error)
            ? { ok: false, aborted: true }
            : { ok: false, error: 'network' };
    }

    if (response.status === 201) {
        const parsed = submissionResponseSchema.safeParse(
            await readBody(response),
        );

        return parsed.success
            ? { ok: true, protocol: parsed.data.data.protocol }
            : { ok: false, error: 'invalid' };
    }

    if (response.status === 429) {
        return {
            ok: false,
            error: 'rateLimited',
            retryAfterS: retryAfter(response),
        };
    }

    const body = await readBody(response);

    if (response.status === 409) {
        return {
            ok: false,
            error:
                body.code === 'already_in_catalog'
                    ? 'alreadyInCatalog'
                    : 'alreadyPending',
        };
    }

    if (response.status === 422) {
        if (body.code === 'verification_failed') {
            return { ok: false, error: 'verification' };
        }

        return {
            ok: false,
            error: 'invalid',
            fieldErrors: fieldErrorsOf(body),
        };
    }

    return { ok: false, error: 'server' };
}
