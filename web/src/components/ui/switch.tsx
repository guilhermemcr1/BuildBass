import type { ReactNode } from 'react';
import { Switch as AriaSwitch } from 'react-aria-components';
import { cn } from '@/lib/utils';

type SwitchProps = {
    selected: boolean;
    onChange: (selected: boolean) => void;
    disabled?: boolean;
    className?: string;
    children: ReactNode;
};

// Liga/desliga com efeito imediato (preferência, modo de vista). Para uma opção dentro de um
// formulário, que só vale ao confirmar, o par é o `Checkbox`.
export function Switch({
    selected,
    onChange,
    disabled = false,
    className,
    children,
}: SwitchProps) {
    return (
        <AriaSwitch
            isSelected={selected}
            onChange={onChange}
            isDisabled={disabled}
            className={cn(
                'group flex cursor-default items-center gap-2 text-[13px] outline-none data-[disabled]:text-disabled',
                className,
            )}
        >
            <span
                aria-hidden="true"
                className="relative h-5 w-9 shrink-0 rounded-full border border-border bg-raised motion-safe:transition-colors group-data-[disabled]:opacity-50 group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-accent group-data-[focus-visible]:outline-solid group-data-[hovered]:border-muted group-data-[selected]:border-accent group-data-[selected]:bg-accent"
            >
                <span className="absolute top-1/2 left-0.5 size-3.5 -translate-y-1/2 rounded-full bg-muted shadow-sm motion-safe:transition-[transform,background-color] motion-safe:duration-200 group-data-[selected]:translate-x-4 group-data-[selected]:bg-accent-foreground" />
            </span>
            {children}
        </AriaSwitch>
    );
}
