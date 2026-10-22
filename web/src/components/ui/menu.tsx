import type { Key, ReactNode } from 'react';
import {
    Button as AriaButton,
    Menu as AriaMenu,
    MenuItem,
    MenuTrigger,
    Popover,
} from 'react-aria-components';
import { cn } from '@/lib/utils';

export type MenuOption<T extends string> = {
    id: T;
    label: string;
    // Enfeite antes do texto (ex.: bandeira); deve ser `aria-hidden`, o nome acessível é o `label`.
    icon?: ReactNode;
    disabled?: boolean;
};

type MenuProps<T extends string> = {
    label: string;
    // Nome acessível do botão; precisa conter o texto visível do gatilho (WCAG 2.5.3).
    triggerLabel?: string;
    trigger: ReactNode;
    items: MenuOption<T>[];
    selected?: T;
    onAction: (id: T) => void;
    triggerClassName?: string;
};

export function Menu<T extends string>({
    label,
    triggerLabel,
    trigger,
    items,
    selected,
    onAction,
    triggerClassName,
}: MenuProps<T>) {
    return (
        <MenuTrigger>
            <AriaButton
                // Fora de qualquer slot: dentro de um NumberField o botão herdaria os slots
                // de incremento/decremento.
                slot={null}
                aria-label={triggerLabel ?? label}
                className={cn(
                    'cursor-default rounded-sm outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-offset-1 data-[focus-visible]:outline-accent',
                    triggerClassName,
                )}
            >
                {trigger}
            </AriaButton>
            <Popover
                placement="bottom end"
                offset={4}
                className="min-w-28 rounded-md border border-border bg-raised p-1 shadow-lg"
            >
                <AriaMenu
                    aria-label={label}
                    selectionMode={selected === undefined ? undefined : 'single'}
                    selectedKeys={selected === undefined ? undefined : [selected]}
                    disabledKeys={items
                        .filter((item) => item.disabled)
                        .map((item) => item.id)}
                    onAction={(key: Key) => onAction(key as T)}
                    className="outline-none"
                >
                    {items.map((item) => (
                        <MenuItem
                            key={item.id}
                            id={item.id}
                            className="flex cursor-default items-center justify-between gap-3 rounded-sm px-2.5 py-1.5 text-sm text-foreground outline-none data-[disabled]:text-disabled data-[focused]:bg-surface data-[selected]:font-semibold data-[selected]:text-accent-soft"
                        >
                            {item.icon === undefined ? (
                                item.label
                            ) : (
                                <span className="flex items-center gap-2">
                                    {item.icon}
                                    {item.label}
                                </span>
                            )}
                        </MenuItem>
                    ))}
                </AriaMenu>
            </Popover>
        </MenuTrigger>
    );
}
