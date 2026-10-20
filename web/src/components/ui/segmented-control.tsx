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
    className?: string;
};

export function SegmentedControl<T extends string>({
    label,
    options,
    selected,
    onChange,
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
                'inline-flex gap-1 rounded-md border border-border bg-raised p-[3px]',
                className,
            )}
        >
            {options.map((option) => (
                <ToggleButton
                    key={option.id}
                    id={option.id}
                    isDisabled={option.disabled}
                    className="h-7 flex-1 cursor-default rounded-sm px-2.5 text-[13px] whitespace-nowrap text-muted outline-none data-[disabled]:text-disabled data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[hovered]:text-foreground data-[selected]:bg-surface data-[selected]:text-foreground data-[selected]:shadow-sm"
                >
                    {option.label}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
