import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Checkbox as AriaCheckbox } from 'react-aria-components';
import { cn } from '@/lib/utils';

type CheckboxProps = {
    selected: boolean;
    onChange: (selected: boolean) => void;
    disabled?: boolean;
    className?: string;
    children: ReactNode;
};

// Caixa de seleção com o visto desenhado (nunca só a cor indica o estado).
export function Checkbox({
    selected,
    onChange,
    disabled = false,
    className,
    children,
}: CheckboxProps) {
    return (
        <AriaCheckbox
            isSelected={selected}
            onChange={onChange}
            isDisabled={disabled}
            className={cn(
                'group flex cursor-default items-center gap-2 text-sm outline-none data-[disabled]:text-disabled',
                className,
            )}
        >
            {({ isSelected }) => (
                <>
                    <span
                        aria-hidden="true"
                        className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-border bg-raised group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-accent group-data-[focus-visible]:outline-solid group-data-[selected]:border-accent group-data-[selected]:bg-accent"
                    >
                        {isSelected && (
                            <Check className="size-3 text-accent-foreground" />
                        )}
                    </span>
                    {children}
                </>
            )}
        </AriaCheckbox>
    );
}
