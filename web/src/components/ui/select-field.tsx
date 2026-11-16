import { Check, ChevronDown } from 'lucide-react';
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
import { InfoTip } from './help-tip';

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
    // O título do grupo já diz o que é: o rótulo fica só para o leitor de tela.
    hideLabel?: boolean;
    // Ícone "i" ao lado do rótulo, para explicar o que a escolha muda.
    help?: { content: string; label: string };
    className?: string;
};

// Escolha de uma opção entre várias com rótulos longos (React Aria `Select`).
export function SelectField<T extends string>({
    label,
    options,
    selected,
    onChange,
    disabled = false,
    hideLabel = false,
    help,
    className,
}: SelectFieldProps<T>) {
    const labelElement = (
        <Label
            className={cn(
                'text-xs font-semibold text-muted',
                hideLabel && 'sr-only',
            )}
        >
            {label}
        </Label>
    );

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
            {help === undefined ? (
                labelElement
            ) : (
                <div className="flex items-center gap-1">
                    {labelElement}
                    <InfoTip content={help.content} label={help.label} />
                </div>
            )}
            <Button className="flex h-8 cursor-default items-center justify-between gap-2 rounded-md border border-border bg-raised px-2.5 text-sm motion-safe:transition-colors text-foreground outline-none data-[disabled]:opacity-60 data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-accent data-[pressed]:border-accent">
                <SelectValue className="truncate" />
                <ChevronDown
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted motion-safe:transition-transform group-data-[open]:rotate-180"
                />
            </Button>
            <Popover className="pop w-(--trigger-width) rounded-md border border-border bg-raised p-1 shadow-lg">
                <ListBox className="max-h-64 overflow-auto outline-none">
                    {options.map((option) => (
                        <ListBoxItem
                            key={option.id}
                            id={option.id}
                            textValue={option.label}
                            className="flex cursor-default items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-sm outline-none motion-safe:transition-colors data-[focused]:bg-surface data-[selected]:font-semibold data-[selected]:text-accent-soft"
                        >
                            {({ isSelected }) => (
                                <>
                                    {option.label}
                                    {isSelected && (
                                        <Check
                                            aria-hidden="true"
                                            className="size-3.5 shrink-0"
                                        />
                                    )}
                                </>
                            )}
                        </ListBoxItem>
                    ))}
                </ListBox>
            </Popover>
        </Select>
    );
}
