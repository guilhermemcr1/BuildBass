import { useSyncExternalStore } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
    Button as AriaButton,
    Dialog,
    DialogTrigger,
    Focusable,
    Popover,
} from 'react-aria-components';
import { Info } from 'lucide-react';
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

// Ajuda curta de um rótulo ou símbolo: tooltip ao pairar ou focar; em
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
                    className="pop max-w-64 rounded-md border border-border bg-raised px-2.5 py-1.5 text-xs leading-snug text-foreground shadow-lg"
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

type InfoTipProps = {
    content: ReactNode;
    // Nome acessível do botão (ex.: "Ajuda: Proporção").
    label: string;
};

// Ícone "i" ao lado de um título: explica o que o grupo faz sem ocupar uma linha de texto. Pairar
// ou focar abre o tooltip; em tela de toque vira popover (o mesmo `HelpTip`).
export function InfoTip({ content, label }: InfoTipProps) {
    const hoverless = useHoverless();
    const icon = <Info aria-hidden="true" className="size-3.5" />;
    const className =
        'inline-flex size-5 cursor-help items-center justify-center rounded-full text-muted outline-none motion-safe:transition-colors data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:text-foreground';

    if (hoverless) {
        return (
            <HelpTip content={content} label={label}>
                {icon}
            </HelpTip>
        );
    }

    return (
        <Tooltip content={content}>
            <AriaButton slot={null} aria-label={label} className={className}>
                {icon}
            </AriaButton>
        </Tooltip>
    );
}
