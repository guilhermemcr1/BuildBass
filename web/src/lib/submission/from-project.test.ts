import { describe, expect, test } from 'vite-plus/test';
import { emptyForm, hasChanges } from './from-project';

describe('hasChanges', () => {
    test('detecta alteração em relação ao estado inicial', () => {
        const initial = emptyForm();

        expect(hasChanges(initial, initial)).toBe(false);
        expect(hasChanges({ ...initial, brand: 'x' }, initial)).toBe(true);
    });
});
