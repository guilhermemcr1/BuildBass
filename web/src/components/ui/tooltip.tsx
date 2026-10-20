import type { ReactElement, ReactNode } from 'react';
import {
    Tooltip as AriaTooltip,
    TooltipTrigger,
} from 'react-aria-components';

type TooltipProps = {
    content: ReactNode;
    children: ReactElement;
    delay?: number;
};

export function Tooltip({ content, children, delay = 400 }: TooltipProps) {
    return (
        <TooltipTrigger delay={delay} closeDelay={100}>
            {children}
            <AriaTooltip
                offset={6}
                className="max-w-64 rounded-md border border-border bg-raised px-2.5 py-1.5 text-xs leading-snug text-foreground shadow-lg"
            >
                {content}
            </AriaTooltip>
        </TooltipTrigger>
    );
}
