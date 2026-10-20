import { Search } from 'lucide-react';
import type { Key } from 'react';
import {
    ComboBox,
    Input,
    Label,
    ListBox,
    ListBoxItem,
    Popover,
    Text,
} from 'react-aria-components';
import { cn } from '@/lib/utils';

export type SearchOption = { id: string; label: string };

type SearchSelectProps = {
    label: string;
    placeholder?: string;
    items: SearchOption[];
    onSelect: (id: string) => void;
    disabled?: boolean;
    disabledReason?: string;
    className?: string;
};

export function SearchSelect({
    label,
    placeholder,
    items,
    onSelect,
    disabled = false,
    disabledReason,
    className,
}: SearchSelectProps) {
    return (
        <ComboBox
            defaultItems={items}
            isDisabled={disabled}
            onSelectionChange={(key: Key | null) => {
                if (key !== null) {
                    onSelect(String(key));
                }
            }}
            menuTrigger="focus"
            className={cn('group flex flex-col gap-1', className)}
        >
            <Label className="text-xs font-semibold text-muted">{label}</Label>
            <div className="flex h-[34px] items-center gap-2 rounded-md border border-border bg-raised px-2.5 focus-within:border-accent group-data-[disabled]:opacity-60">
                <Search aria-hidden="true" className="size-4 shrink-0 text-muted" />
                <Input
                    placeholder={placeholder}
                    className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed"
                />
            </div>
            {disabled && disabledReason !== undefined && (
                <Text slot="description" className="text-[11px] text-muted">
                    {disabledReason}
                </Text>
            )}
            <Popover className="w-(--trigger-width) rounded-md border border-border bg-raised p-1 shadow-lg">
                <ListBox<SearchOption> className="max-h-64 overflow-auto outline-none">
                    {(item) => (
                        <ListBoxItem
                            id={item.id}
                            className="cursor-default rounded-sm px-2.5 py-1.5 text-sm outline-none data-[focused]:bg-surface"
                        >
                            {item.label}
                        </ListBoxItem>
                    )}
                </ListBox>
            </Popover>
        </ComboBox>
    );
}
