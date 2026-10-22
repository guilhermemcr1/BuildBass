import { useContext, useEffect, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
    Tooltip as AriaTooltip,
    TooltipTrigger,
    TooltipTriggerStateContext,
} from 'react-aria-components';

// Tempo pairando antes de o tooltip abrir; o foco por teclado abre na hora.
export const TOOLTIP_DELAY_MS = 1000;

type TooltipProps = {
    content: ReactNode;
    children: ReactElement;
    delay?: number;
};

// Último tipo de entrada: o foco por teclado abre o tooltip sem espera, o mouse espera o delay.
// O `isFocusVisible` do React Aria não serve aqui, pois só vira falso depois do primeiro clique.
let lastInputWasKeyboard = false;

if (typeof window !== 'undefined') {
    const keyboard = (event: KeyboardEvent) => {
        if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) {
            lastInputWasKeyboard = true;
        }
    };
    const pointer = () => {
        lastInputWasKeyboard = false;
    };

    window.addEventListener('keydown', keyboard, true);

    for (const type of ['pointerdown', 'pointermove', 'mousedown', 'mousemove']) {
        window.addEventListener(type, pointer, true);
    }
}

// O React Aria "aquece" os tooltips: depois que um abre, o próximo abre sem esperar por uns
// 500 ms, o que anulava o delay ao passar do rótulo para o campo. Por isso o gatilho roda sem
// delay próprio (`delay={0}`) e a espera é daqui, a cada abertura.
function Delayed({ delay, children }: { delay: number; children: ReactNode }) {
    const isOpen = useContext(TooltipTriggerStateContext)?.isOpen ?? false;
    const [elapsed, setElapsed] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setElapsed(false);

            return;
        }

        if (delay <= 0 || lastInputWasKeyboard) {
            setElapsed(true);

            return;
        }

        const timer = setTimeout(() => setElapsed(true), delay);

        return () => clearTimeout(timer);
    }, [isOpen, delay]);

    return elapsed ? children : null;
}

export function Tooltip({
    content,
    children,
    delay = TOOLTIP_DELAY_MS,
}: TooltipProps) {
    return (
        <TooltipTrigger delay={0} closeDelay={100}>
            {children}
            <Delayed delay={delay}>
                <AriaTooltip
                    offset={6}
                    className="pop max-w-64 rounded-md border border-border bg-raised px-2.5 py-1.5 text-xs leading-snug text-foreground shadow-lg"
                >
                    {content}
                </AriaTooltip>
            </Delayed>
        </TooltipTrigger>
    );
}
