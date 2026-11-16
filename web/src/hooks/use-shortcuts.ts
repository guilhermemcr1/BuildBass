import { useEffect, useRef } from 'react';

// Mapa único de atalhos: o hook e a ajuda leem daqui.
export type ShortcutId =
    | 'new'
    | 'open'
    | 'export'
    | 'undo'
    | 'redo'
    | 'chartTabs'
    | 'help';

export type Shortcut = {
    id: ShortcutId;
    keys: string[];
    // Ctrl no Windows/Linux, ⌘ no macOS.
    mod?: boolean;
    alt?: boolean;
    shift?: boolean;
    // Só fora de campos de texto, para não roubar a digitação nem o desfazer nativo.
    outsideFields?: boolean;
};

export const SHORTCUTS: Shortcut[] = [
    // Ctrl+N é reservado pelo navegador.
    { id: 'new', keys: ['n'], alt: true },
    { id: 'open', keys: ['o'], mod: true },
    { id: 'export', keys: ['s'], mod: true },
    { id: 'undo', keys: ['z'], mod: true, outsideFields: true },
    { id: 'redo', keys: ['z'], mod: true, shift: true, outsideFields: true },
    { id: 'chartTabs', keys: ['1', '2', '3', '4', '5'], outsideFields: true },
    { id: 'help', keys: ['?'], outsideFields: true },
];

type KeyInput = Pick<
    KeyboardEvent,
    'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
> & { target: EventTarget | null };

export type ShortcutMatch = { id: ShortcutId; key: string };

function insideField(target: EventTarget | null): boolean {
    return (
        target instanceof Element &&
        target.closest(
            'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
        ) !== null
    );
}

// Letras pelo código físico: com Alt no macOS `key` vira outro caractere (Alt+N → ˜).
function pressedKey(event: KeyInput): string {
    return event.code.startsWith('Key')
        ? event.code.slice(3).toLowerCase()
        : event.key.toLowerCase();
}

export function matchShortcut(event: KeyInput): ShortcutMatch | null {
    const mod = event.ctrlKey || event.metaKey;
    const key = pressedKey(event);

    for (const shortcut of SHORTCUTS) {
        if (!shortcut.keys.includes(key)) {
            continue;
        }

        // `?` já exige Shift no teclado; Shift só conta para atalhos com modificador.
        const shiftMatches =
            shortcut.mod === true || shortcut.alt === true
                ? event.shiftKey === (shortcut.shift ?? false)
                : true;

        if (
            mod === (shortcut.mod ?? false) &&
            event.altKey === (shortcut.alt ?? false) &&
            shiftMatches &&
            !(shortcut.outsideFields === true && insideField(event.target))
        ) {
            return { id: shortcut.id, key };
        }
    }

    return null;
}

export function appleKeyboard(): boolean {
    return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

// Teclas para exibição na ajuda, ex.: ['Ctrl', 'Shift', 'Z'] ou ['⌘', '⇧', 'Z'].
export function shortcutKeys(shortcut: Shortcut, apple: boolean): string[] {
    const keys: string[] = [];

    if (shortcut.mod === true) {
        keys.push(apple ? '⌘' : 'Ctrl');
    }

    if (shortcut.alt === true) {
        keys.push(apple ? '⌥' : 'Alt');
    }

    if (shortcut.shift === true) {
        keys.push(apple ? '⇧' : 'Shift');
    }

    const [first] = shortcut.keys;
    const last = shortcut.keys[shortcut.keys.length - 1];
    keys.push(
        shortcut.keys.length > 1
            ? `${first}–${last}`
            : (first ?? '').toUpperCase(),
    );

    return keys;
}

export function useShortcuts(onShortcut: (match: ShortcutMatch) => void) {
    const handler = useRef(onShortcut);

    useEffect(() => {
        handler.current = onShortcut;
    });

    useEffect(() => {
        const listener = (event: KeyboardEvent) => {
            // Com um diálogo aberto o atalho agiria na tela por trás dele.
            if (
                event.defaultPrevented ||
                event.repeat ||
                document.querySelector('[role="dialog"]') !== null
            ) {
                return;
            }

            const match = matchShortcut(event);

            if (match !== null) {
                event.preventDefault();
                handler.current(match);
            }
        };
        window.addEventListener('keydown', listener);

        return () => window.removeEventListener('keydown', listener);
    }, []);
}
