import { describe, expect, it } from 'vitest';
import { requirementOf } from './requirements';

describe('requirementOf', () => {
    it('marca Fs, Qts e Vas como necessários para a resposta', () => {
        expect(requirementOf('fs_hz', 'closed', 'power')).toBe('response');
        expect(requirementOf('qts', 'closed', 'power')).toBe('response');
        expect(requirementOf('vas_m3', 'closed', 'power')).toBe('response');
    });

    it('marca Re, Sd e Qms como necessários para impedância e excursão', () => {
        expect(requirementOf('re_ohm', 'closed', 'power')).toBe('absolute');
        expect(requirementOf('sd_m2', 'closed', 'power')).toBe('absolute');
        expect(requirementOf('qms', 'closed', 'power')).toBe('absolute');
    });

    it('exige da caixa só o que o tipo escolhido usa', () => {
        expect(requirementOf('vb_m3', 'closed', 'power')).toBe('box');
        expect(requirementOf('fb_hz', 'closed', 'power')).toBeUndefined();
        expect(requirementOf('fb_hz', 'vented', 'power')).toBe('box');
        expect(requirementOf('vr_m3', 'vented', 'power')).toBeUndefined();
    });

    it('exige do sinal só a grandeza do modo escolhido', () => {
        expect(requirementOf('power_w', 'closed', 'power')).toBe('signal');
        expect(requirementOf('voltage_v', 'closed', 'power')).toBeUndefined();
        expect(requirementOf('voltage_v', 'closed', 'voltage')).toBe('signal');
    });
});
