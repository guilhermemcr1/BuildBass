import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { simulate } from '@/engine';
import { activeProjectStore } from '@/hooks/use-active-project';
import { renderWithProviders } from '@/test/render';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { SuggestBox } from './suggest-box';

function driver(qts: number) {
    act(() => {
        const store = activeProjectStore().getState();
        store.setDriverValue('fs_hz', 30);
        store.setDriverValue('qts', qts);
        store.setDriverValue('vas_m3', 0.08);
        store.setBoxValue('fb_hz', 40);
    });
}

describe('SuggestBox (US6)', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('sem Fs, Qts e Vas fica desativado e diz o que falta', () => {
        renderWithProviders(<SuggestBox title="Volume">{null}</SuggestBox>);

        expect(
            screen.getByRole('button', { name: 'Sugerir caixa' }),
        ).toBeDisabled();
        expect(
            screen.getByText('Preencha Fs, Qts e Vas para sugerir.'),
        ).toBeInTheDocument();
    });

    test('aplica Vb e Fb numa só etapa de desfazer e mostra o alinhamento', async () => {
        renderWithProviders(<SuggestBox title="Volume">{null}</SuggestBox>);
        driver(0.35);
        // Edições a menos de 400 ms viram uma etapa só; a sugestão precisa ser a dela.
        await new Promise((resolve) => setTimeout(resolve, 450));
        const store = activeProjectStore();
        const before = store.getState().data.box;

        await userEvent.click(
            screen.getByRole('button', { name: 'Sugerir caixa' }),
        );

        const { data } = store.getState();
        const { box } = data;
        // Vb bruto inclui o duto padrão; o volume líquido é o do alinhamento.
        expect(simulate(data).results.net_volume_m3).toBeCloseTo(
            15 * 0.35 ** 2.87 * 0.08,
            9,
        );
        expect(box.fb_hz).toBeCloseTo(0.42 * 30 * 0.35 ** -0.9, 9);
        expect(screen.getByRole('status')).toHaveTextContent(
            /Dutada Thiele\/Keele/,
        );

        act(() => store.temporal.getState().undo());
        expect(store.getState().data.box).toEqual(before);
    });

    test('Qts alto para dutada explica e não muda a caixa', async () => {
        renderWithProviders(<SuggestBox title="Volume">{null}</SuggestBox>);
        driver(0.55);
        const before = activeProjectStore().getState().data.box;

        await userEvent.click(
            screen.getByRole('button', { name: 'Sugerir caixa' }),
        );

        expect(screen.getByRole('status')).toHaveTextContent(
            'Qts 0,55 é alto para dutada',
        );
        expect(activeProjectStore().getState().data.box).toBe(before);
    });

    test('duto grande demais para a caixa explica a área máxima e não muda a caixa', async () => {
        renderWithProviders(<SuggestBox title="Volume">{null}</SuggestBox>);
        act(() => {
            const store = activeProjectStore().getState();
            store.setDriverValue('fs_hz', 30);
            store.setDriverValue('qts', 0.25);
            store.setDriverValue('vas_m3', 0.008);
            store.setPort({ shape: 'round', count: 1, diameter_m: 0.07 });
        });
        const before = activeProjectStore().getState().data.box;

        await userEvent.click(
            screen.getByRole('button', { name: 'Sugerir caixa' }),
        );

        expect(screen.getByRole('status')).toHaveTextContent(
            /área total 38 cm²\) é grande demais.*até 18 cm²/,
        );
        expect(activeProjectStore().getState().data.box).toBe(before);
    });

    test('bandpass: desativado, com o motivo, mesmo com Fs, Qts e Vas preenchidos', () => {
        renderWithProviders(<SuggestBox title="Volume">{null}</SuggestBox>);
        driver(0.35);
        act(() => activeProjectStore().getState().setBoxType('bandpass'));

        const button = screen.getByRole('button', { name: 'Sugerir caixa' });
        const reason = 'Sugestão disponível só para caixa selada e dutada.';

        expect(button).toBeDisabled();
        expect(screen.getByText(reason)).toBeInTheDocument();
        expect(button).toHaveAccessibleDescription(reason);
    });
});
