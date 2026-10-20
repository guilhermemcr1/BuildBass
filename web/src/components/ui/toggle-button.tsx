import type { ReactNode } from 'react';
import { ToggleButton as AriaToggleButton } from 'react-aria-components';
import { cn } from '@/lib/utils';

type ToggleButtonProps = {
    pressed: boolean;
    onPressedChange: (pressed: boolean) => void;
    'aria-label'?: string;
    className?: string;
    children: ReactNode;
};

// Botão liga/desliga (aria-pressed), na aparência quiet.
export function ToggleButton({
    pressed,
    onPressedChange,
    className,
    children,
    ...props
}: ToggleButtonProps) {
    return (
        <AriaToggleButton
            {...props}
            isSelected={pressed}
            onChange={onPressedChange}
            className={cn(
                'inline-flex size-7 cursor-default items-center justify-center rounded-md text-muted outline-none motion-safe:transition-colors data-[hovered]:bg-raised data-[hovered]:text-foreground data-[selected]:text-foreground data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-offset-1 data-[focus-visible]:outline-accent',
                className,
            )}
        >
            {children}
        </AriaToggleButton>
    );
}
