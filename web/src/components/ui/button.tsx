import type { ReactNode } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import type { ButtonProps as AriaButtonProps } from 'react-aria-components';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

type ButtonProps = Omit<AriaButtonProps, 'isDisabled' | 'className' | 'children'> & {
    variant?: ButtonVariant;
    disabled?: boolean;
    className?: string;
    children: ReactNode;
};

const VARIANTS: Record<ButtonVariant, string> = {
    primary:
        'border-accent bg-accent font-semibold text-accent-foreground data-[hovered]:brightness-110 data-[pressed]:brightness-95',
    secondary:
        'border-border bg-raised text-foreground data-[hovered]:border-muted data-[pressed]:bg-surface',
    quiet: 'border-transparent bg-transparent text-foreground data-[hovered]:bg-raised data-[pressed]:bg-surface',
};

export function Button({
    variant = 'secondary',
    disabled = false,
    className,
    children,
    ...props
}: ButtonProps) {
    return (
        <AriaButton
            {...props}
            isDisabled={disabled}
            className={cn(
                'inline-flex h-[34px] cursor-default items-center justify-center gap-2 rounded-md border px-3.5 text-sm whitespace-nowrap outline-none motion-safe:transition-colors data-[disabled]:border-border data-[disabled]:bg-raised data-[disabled]:text-disabled data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent',
                VARIANTS[variant],
                className,
            )}
        >
            {children}
        </AriaButton>
    );
}
