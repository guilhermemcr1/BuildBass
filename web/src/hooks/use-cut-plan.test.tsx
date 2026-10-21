import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { useCutPlan } from './use-cut-plan';

describe('useCutPlan', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('projeto vazio está bloqueado e diz que falta o volume', () => {
        const { result } = renderHook(() => useCutPlan());

        expect(result.current).toMatchObject({
            status: 'blocked',
            missing: ['vb_m3'],
        });
    });

    test('com volume o plano fica pronto e acompanha as edições', () => {
        const { result } = renderHook(() => useCutPlan());

        act(() => activeProjectStore().getState().setBoxValue('vb_m3', 0.06));

        expect(result.current.status).toBe('ready');

        const before = result.current;
        act(() => activeProjectStore().getState().setBoxValue('vb_m3', 0.1));

        expect(result.current).not.toBe(before);
        expect(result.current.status).toBe('ready');
    });

    test('reaproveita o resultado para o mesmo objeto de dados', () => {
        act(() => activeProjectStore().getState().setBoxValue('vb_m3', 0.06));
        const first = renderHook(() => useCutPlan());
        const second = renderHook(() => useCutPlan());

        expect(second.result.current).toBe(first.result.current);
    });

    test('segue a troca de aba', () => {
        act(() => activeProjectStore().getState().setBoxValue('vb_m3', 0.06));
        const { result } = renderHook(() => useCutPlan());

        act(() => {
            useWorkspace.getState().newProject();
        });

        expect(result.current.status).toBe('blocked');
    });
});
