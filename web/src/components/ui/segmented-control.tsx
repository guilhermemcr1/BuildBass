import type { Key } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { cn } from '@/lib/utils';

export type SegmentOption<T extends string> = {
    id: T;
    label: string;
    disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
    label: string;
    options: SegmentOption<T>[];
    selected: T;
    onChange: (id: T) => void;
    // `sm` para os grupos dentro dos painéis (ligação, sinal, duto): mais baixo e com texto menor.
    size?: 'md' | 'sm';
    className?: string;
};

export function SegmentedControl<T extends string>({
    label,
    options,
    selected,
    onChange,
    size = 'md',
    className,
}: SegmentedControlProps<T>) {
    return (
        <ToggleButtonGroup
            aria-label={label}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[selected]}
            onSelectionChange={(keys: Set<Key>) => {
                const [first] = keys;

                if (first !== undefined) {
                    onChange(first as T);
                }
            }}
            className={cn(
                'inline-flex flex-wrap gap-1 rounded-md border border-border bg-raised p-[3px]',
                className,
            )}
        >
            {options.map((option) => (
                <ToggleButton
                    key={option.id}
                    id={option.id}
                    isDisabled={option.disabled}
                    className={cn(
                        'flex-1 cursor-default rounded-sm whitespace-nowrap text-muted outline-none data-[disabled]:text-disabled data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-accent data-[hovered]:text-foreground data-[selected]:bg-surface data-[selected]:text-foreground data-[selected]:shadow-sm',
                        size === 'sm'
                            ? 'h-6 px-2 text-xs'
                            : 'h-7 px-2.5 text-[13px]',
                    )}
                >
                    {option.label}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
