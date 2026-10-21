import { ChevronDown } from 'lucide-react';
import type { Key } from 'react';
import {
    Button,
    Label,
    ListBox,
    ListBoxItem,
    Popover,
    Select,
    SelectValue,
} from 'react-aria-components';
import { cn } from '@/lib/utils';

export type SelectOption<T extends string> = {
    id: T;
    label: string;
};

type SelectFieldProps<T extends string> = {
    label: string;
    options: SelectOption<T>[];
    selected: T;
    onChange: (id: T) => void;
    disabled?: boolean;
    className?: string;
};

// Escolha de uma opção entre várias com rótulos longos (React Aria `Select`).
export function SelectField<T extends string>({
    label,
    options,
    selected,
    onChange,
    disabled = false,
    className,
}: SelectFieldProps<T>) {
    return (
        <Select
            selectedKey={selected}
            onSelectionChange={(key: Key | null) => {
                if (key !== null) {
                    onChange(String(key) as T);
                }
            }}
            isDisabled={disabled}
            className={cn('group flex flex-col gap-1', className)}
        >
            <Label className="text-xs font-semibold text-muted">{label}</Label>
            <Button className="flex h-[34px] cursor-default items-center justify-between gap-2 rounded-md border border-border bg-raised px-2.5 text-sm text-foreground outline-none data-[disabled]:opacity-60 data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-accent data-[pressed]:border-accent">
                <SelectValue className="truncate" />
                <ChevronDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted"
                />
            </Button>
            <Popover className="w-(--trigger-width) rounded-md border border-border bg-raised p-1 shadow-lg">
                <ListBox className="max-h-64 overflow-auto outline-none">
                    {options.map((option) => (
                        <ListBoxItem
                            key={option.id}
                            id={option.id}
                            textValue={option.label}
                            className="cursor-default rounded-sm px-2.5 py-1.5 text-sm outline-none data-[focused]:bg-surface data-[selected]:font-semibold"
                        >
                            {option.label}
                        </ListBoxItem>
                    ))}
                </ListBox>
            </Popover>
        </Select>
    );
}
