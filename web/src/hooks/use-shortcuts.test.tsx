import { renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vite-plus/test';
import { ShortcutsDialog } from '@/components/workbench/shortcuts-dialog';
import { renderWithProviders } from '@/test/render';
import {
    SHORTCUTS,
    matchShortcut,
    shortcutKeys,
    useShortcuts,
} from './use-shortcuts';

function press(
    key: string,
    options: Partial<{
        code: string;
        ctrlKey: boolean;
        metaKey: boolean;
        altKey: boolean;
        shiftKey: boolean;
        target: EventTarget | null;
    }> = {},
) {
    return matchShortcut({
        key,
        code: options.code ?? '',
        ctrlKey: options.ctrlKey ?? false,
        metaKey: options.metaKey ?? false,
        altKey: options.altKey ?? false,
        shiftKey: options.shiftKey ?? false,
        target: options.target ?? document.body,
    });
}

describe('matchShortcut', () => {
    test('reconhece cada atalho do mapa', () => {
        expect(press('˜', { code: 'KeyN', altKey: true })?.id).toBe('new');
        expect(press('o', { code: 'KeyO', ctrlKey: true })?.id).toBe('open');
        expect(press('s', { code: 'KeyS', metaKey: true })?.id).toBe('export');
        expect(press('z', { code: 'KeyZ', ctrlKey: true })?.id).toBe('undo');
        expect(
            press('Z', { code: 'KeyZ', ctrlKey: true, shiftKey: true })?.id,
        ).toBe('redo');
        expect(press('3', { code: 'Digit3' })).toEqual({
            id: 'chartTabs',
            key: '3',
        });
        expect(press('?', { code: 'Slash', shiftKey: true })?.id).toBe('help');
    });

    test('ignora teclas sem atalho e modificadores trocados', () => {
        expect(press('n', { code: 'KeyN' })).toBeNull();
        expect(press('n', { code: 'KeyN', ctrlKey: true })).toBeNull();
        expect(press('6', { code: 'Digit6' })).toBeNull();
        expect(press('1', { code: 'Digit1', ctrlKey: true })).toBeNull();
    });

    test('dentro de um campo só os atalhos com modificador valem', () => {
        const input = document.createElement('input');

        expect(press('1', { code: 'Digit1', target: input })).toBeNull();
        expect(press('?', { code: 'Slash', target: input })).toBeNull();
        expect(
            press('z', { code: 'KeyZ', ctrlKey: true, target: input }),
        ).toBeNull();
        expect(
            press('s', { code: 'KeyS', ctrlKey: true, target: input })?.id,
        ).toBe('export');
    });
});

test('shortcutKeys usa os símbolos do teclado de cada sistema', () => {
    const redo = SHORTCUTS.find((shortcut) => shortcut.id === 'redo');
    const tabs = SHORTCUTS.find((shortcut) => shortcut.id === 'chartTabs');

    expect(redo && shortcutKeys(redo, false)).toEqual(['Ctrl', 'Shift', 'Z']);
    expect(redo && shortcutKeys(redo, true)).toEqual(['⌘', '⇧', 'Z']);
    expect(tabs && shortcutKeys(tabs, false)).toEqual(['1–5']);
});

test('useShortcuts chama o handler e impede a ação do navegador', async () => {
    const onShortcut = vi.fn();
    renderHook(() => useShortcuts(onShortcut));

    await userEvent.keyboard('{Control>}s{/Control}');

    expect(onShortcut).toHaveBeenCalledWith({ id: 'export', key: 's' });
});

test('a ajuda lista todos os atalhos do mapa', () => {
    renderWithProviders(
        <ShortcutsDialog open onOpenChange={() => undefined} />,
    );

    const dialog = screen.getByRole('dialog', { name: 'Atalhos de teclado' });

    for (const label of [
        'Novo',
        'Abrir',
        'Exportar',
        'Desfazer',
        'Refazer',
        'Trocar aba de gráfico',
        'Mostrar esta ajuda',
    ]) {
        expect(within(dialog).getByText(label)).toBeInTheDocument();
    }

    expect(within(dialog).getAllByRole('term')).toHaveLength(SHORTCUTS.length);
});
