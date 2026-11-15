import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuid } from './utils';

const V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuid', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('usa crypto.randomUUID quando existe', () => {
        expect(uuid()).toMatch(V4);
    });

    it('fora de contexto seguro (sem randomUUID) gera um v4 por getRandomValues', () => {
        vi.stubGlobal('crypto', {
            getRandomValues: crypto.getRandomValues.bind(crypto),
        });
        const a = uuid();
        expect(a).toMatch(V4);
        expect(uuid()).not.toBe(a);
    });
});
