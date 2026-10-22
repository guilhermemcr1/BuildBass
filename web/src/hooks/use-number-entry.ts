import { useCallback } from 'react';
import { normalizePasted, typedSeparator } from '@/lib/units/number-entry';

// Troca o trecho selecionado do campo e avisa o React, como se tivesse sido digitado.
function insert(input: HTMLInputElement, text: string) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;

    input.setRangeText(text, start, end, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Ref para o `<Input>` de um NumberField: ponto e vírgula viram o decimal do idioma ao digitar,
// e o texto colado é normalizado (separadores, expoente, unidade no fim) antes de entrar.
export function useNumberEntry(locale: string) {
    return useCallback(
        (input: HTMLInputElement | null) => {
            if (input === null) {
                return;
            }

            const onBeforeInput = (event: InputEvent) => {
                if (
                    event.inputType !== 'insertText' ||
                    event.data === null ||
                    event.isComposing
                ) {
                    return;
                }

                const mapped = typedSeparator(event.data, locale);

                if (mapped !== event.data) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    insert(input, mapped);
                }
            };

            const onPaste = (event: ClipboardEvent) => {
                const text = event.clipboardData?.getData('text') ?? '';
                const normalized = normalizePasted(text, locale);

                event.preventDefault();

                if (normalized !== undefined) {
                    insert(input, normalized);
                }
            };

            input.addEventListener('beforeinput', onBeforeInput, true);
            input.addEventListener('paste', onPaste);

            return () => {
                input.removeEventListener('beforeinput', onBeforeInput, true);
                input.removeEventListener('paste', onPaste);
            };
        },
        [locale],
    );
}
