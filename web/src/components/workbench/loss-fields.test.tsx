import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { renderWithProviders } from '@/test/render';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { LossFields } from './loss-fields';

async function choose(field: RegExp, option: string) {
    await userEvent.click(screen.getByRole('button', { name: field }));
    await userEvent.click(screen.getByRole('option', { name: option }));
}

describe('LossFields', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('o Ql padrão 7 aparece como o preset do Hornresp e das tabelas', () => {
        renderWithProviders(<LossFields />);

        expect(
            screen.getByRole('button', { name: /Perdas \(Ql\)/ }),
        ).toHaveTextContent('7 (padrão)');
    });

    test('escolher o padrão do WinISD grava Ql 10; outro número vira "Outro valor"', async () => {
        renderWithProviders(<LossFields />);

        await choose(/Perdas \(Ql\)/, '10 (WinISD)');
        expect(activeProjectStore().getState().data.box.ql).toBe(10);

        act(() => activeProjectStore().getState().setBoxValue('ql', 12));
        expect(
            await screen.findByRole('button', { name: /Perdas \(Ql\)/ }),
        ).toHaveTextContent('Outro valor');
    });

    test('material de absorção grava o enchimento; "Sem material" tira do projeto', async () => {
        renderWithProviders(<LossFields />);

        await choose(/Material de absorção/, 'Câmara preenchida');
        expect(activeProjectStore().getState().data.box.fill).toBe('stuffed');

        await choose(/Material de absorção/, 'Sem material');
        expect('fill' in activeProjectStore().getState().data.box).toBe(false);
    });
});
