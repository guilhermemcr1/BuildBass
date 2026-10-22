import { useSyncExternalStore } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
    Button as AriaButton,
    Dialog,
    DialogTrigger,
    Focusable,
    Popover,
} from 'react-aria-components';
import { Tooltip } from './tooltip';

// Ponteiro sem hover (toque): o React Aria não abre tooltip por toque, então a ajuda vira um
// popover aberto por um botão.
const HOVERLESS = '(hover: none)';

function subscribe(onChange: () => void) {
    const query = window.matchMedia?.(HOVERLESS);

    query?.addEventListener('change', onChange);

    return () => query?.removeEventListener('change', onChange);
}

function snapshot() {
    return window.matchMedia?.(HOVERLESS).matches ?? false;
}

export function useHoverless(): boolean {
    return useSyncExternalStore(subscribe, snapshot, () => false);
}

type HelpTipProps = {
    content: ReactNode;
    // Nome acessível do botão que abre a ajuda em tela de toque.
    label: string;
    children: ComponentProps<typeof Focusable>['children'];
    delay?: number;
};

// Ajuda curta de um rótulo ou símbolo (specs/008, FR-001–003): tooltip ao pairar ou focar; em
// tela de toque, popover aberto por um botão. O texto também continua disponível ao leitor de tela
// pela descrição do campo, então o tooltip é um complemento visual.
export function HelpTip({ content, label, children, delay }: HelpTipProps) {
    const hoverless = useHoverless();

    if (hoverless) {
        return (
            <DialogTrigger>
                <AriaButton
                    // Fora de qualquer slot: dentro de um NumberField o botão herdaria os de
                    // incremento/decremento.
                    slot={null}
                    aria-label={label}
                    className="cursor-help rounded-sm outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-1 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid"
                >
                    {children}
                </AriaButton>
                <Popover
                    placement="bottom start"
                    offset={6}
                    className="max-w-64 rounded-md border border-border bg-raised px-2.5 py-1.5 text-xs leading-snug text-foreground shadow-lg"
                >
                    <Dialog aria-label={label} className="outline-none">
                        {content}
                    </Dialog>
                </Popover>
            </DialogTrigger>
        );
    }

    return (
        <Tooltip content={content} delay={delay}>
            <Focusable>{children}</Focusable>
        </Tooltip>
    );
}
