import type { Key, ReactNode } from 'react';
import {
    Tabs as AriaTabs,
    Tab,
    TabList,
    TabPanel,
} from 'react-aria-components';
import { cn } from '@/lib/utils';

export type TabItem<T extends string> = {
    id: T;
    label: string;
    disabled?: boolean;
};

type TabsProps<T extends string> = {
    label: string;
    items: TabItem<T>[];
    selected: T;
    onChange: (id: T) => void;
    className?: string;
    children: (id: T) => ReactNode;
};

export function Tabs<T extends string>({
    label,
    items,
    selected,
    onChange,
    className,
    children,
}: TabsProps<T>) {
    return (
        <AriaTabs
            selectedKey={selected}
            onSelectionChange={(key: Key) => onChange(key as T)}
            className={cn('flex min-h-0 flex-col', className)}
        >
            <TabList
                aria-label={label}
                className="flex gap-1 overflow-x-auto border-b border-border"
            >
                {items.map((item) => (
                    <Tab
                        key={item.id}
                        id={item.id}
                        isDisabled={item.disabled}
                        className="h-[34px] shrink-0 cursor-default px-3 text-[13px] leading-[34px] font-medium whitespace-nowrap text-muted outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:-outline-offset-2 data-[focus-visible]:outline-accent data-[hovered]:text-foreground data-[selected]:text-foreground data-[selected]:shadow-[inset_0_-2px_0_var(--accent)] data-[disabled]:text-disabled"
                    >
                        {item.label}
                    </Tab>
                ))}
            </TabList>
            {items.map((item) => (
                <TabPanel
                    key={item.id}
                    id={item.id}
                    className="min-h-0 flex-1 rounded-sm outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-accent"
                >
                    {children(item.id)}
                </TabPanel>
            ))}
        </AriaTabs>
    );
}
