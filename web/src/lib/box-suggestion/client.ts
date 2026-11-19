import { z } from 'zod';
import { apiUrl } from '@/lib/api';
import { aborted, readBody, retryAfter } from '@/lib/submission/client';

// Cliente da sugestão de caixa por IA. Nunca lança: devolve os candidatos ou o motivo da falha. O
// servidor já descarta o que sai da faixa física; aqui o formato é conferido de novo, porque o front
// não confia no que recebe. Os candidatos ainda passam pelo motor antes de serem mostrados.

export const AI_USAGES = ['car', 'home', 'pro'] as const;
export const AI_PRIORITIES = ['deep', 'tight', 'loud'] as const;

export type AiUsage = (typeof AI_USAGES)[number];
export type AiPriority = (typeof AI_PRIORITIES)[number];

const port = z.union([
    z.object({
        shape: z.literal('round'),
        diameter_m: z.number().positive(),
        count: z.number().int().min(1).max(8),
    }),
    z.object({
        shape: z.literal('rect'),
        width_m: z.number().positive(),
        height_m: z.number().positive(),
        count: z.number().int().min(1).max(8),
    }),
]);

const candidate = z.object({
    type: z.enum(['closed', 'vented']),
    vb_m3: z.number().positive().max(2),
    fb_hz: z.number().positive().max(500).nullable(),
    port: port.nullable(),
    title: z.string().max(120),
    rationale: z.string().max(600),
});

export type AiCandidate = z.infer<typeof candidate>;

const response = z.object({
    data: z.object({ candidates: z.array(candidate).min(1).max(3) }),
});

export type AiSuggestionRequest = {
    locale: 'pt-BR' | 'en';
    driver: {
        fs_hz: number;
        qts: number;
        vas_m3: number;
        qes?: number;
        re_ohm?: number;
        xmax_m?: number;
        sd_m2?: number;
        pe_w?: number;
        vd_m3?: number;
    };
    drivers_count: number;
    usage: AiUsage;
    priority: AiPriority;
    max_volume_m3?: number;
    classic?: {
        type: 'closed' | 'vented';
        vb_m3: number;
        fb_hz?: number;
        alignment?: string;
    };
    // Campo-armadilha: o usuário nunca o preenche.
    website: string;
    turnstile_token?: string;
};

export type AiSuggestionError =
    | 'network'
    | 'server'
    | 'rateLimited'
    | 'unavailable'
    | 'providerFailed'
    | 'verification';

export type AiSuggestionResult =
    | { ok: true; candidates: AiCandidate[] }
    | {
          ok: false;
          error: AiSuggestionError;
          retryAfterS?: number;
          aborted?: false;
      }
    | { ok: false; aborted: true };

export async function requestAiSuggestion(
    request: AiSuggestionRequest,
    signal?: AbortSignal,
): Promise<AiSuggestionResult> {
    let res: Response;

    try {
        res = await fetch(apiUrl('/api/box-suggestions'), {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
            signal,
        });
    } catch (error) {
        return aborted(error)
            ? { ok: false, aborted: true }
            : { ok: false, error: 'network' };
    }

    const content = await readBody(res);

    if (res.status === 200) {
        const parsed = response.safeParse(content);

        return parsed.success
            ? { ok: true, candidates: parsed.data.data.candidates }
            : { ok: false, error: 'server' };
    }

    if (res.status === 429) {
        return {
            ok: false,
            error: 'rateLimited',
            retryAfterS: retryAfter(res),
        };
    }

    if (res.status === 503) {
        return { ok: false, error: 'unavailable' };
    }

    if (res.status === 502) {
        return { ok: false, error: 'providerFailed' };
    }

    if (res.status === 422 && content.code === 'verification_failed') {
        return { ok: false, error: 'verification' };
    }

    return { ok: false, error: 'server' };
}
