import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { renderWithProviders } from '@/test/render';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { SuggestBox } from './suggest-box';

describe('SuggestBox', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('só oferece a sugestão por IA', () => {
        renderWithProviders(<SuggestBox title="Volume">{null}</SuggestBox>);

        expect(
            screen.queryByRole('button', { name: 'Sugerir caixa' }),
        ).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Sugerir com IA' }),
        ).toBeInTheDocument();
    });

    test('sem Fs, Qts e Vas fica desativado e diz o que falta', () => {
        renderWithProviders(<SuggestBox title="Volume">{null}</SuggestBox>);

        expect(
            screen.getByRole('button', { name: 'Sugerir com IA' }),
        ).toBeDisabled();
        expect(
            screen.getByText('Preencha Fs, Qts e Vas para sugerir.'),
        ).toBeInTheDocument();
    });

    test('bandpass: desativado, com o motivo, mesmo com Fs, Qts e Vas preenchidos', () => {
        renderWithProviders(<SuggestBox title="Volume">{null}</SuggestBox>);
        act(() => {
            const store = activeProjectStore().getState();
            store.setDriverValue('fs_hz', 30);
            store.setDriverValue('qts', 0.35);
            store.setDriverValue('vas_m3', 0.08);
            store.setBoxType('bandpass');
        });

        const button = screen.getByRole('button', { name: 'Sugerir com IA' });
        const reason = 'Sugestão disponível só para caixa selada e dutada.';

        expect(button).toBeDisabled();
        expect(screen.getByText(reason)).toBeInTheDocument();
        expect(button).toHaveAccessibleDescription(reason);
    });
});
