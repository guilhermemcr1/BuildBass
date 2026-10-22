import type { Key, ReactNode } from 'react';
import {
    Tabs as AriaTabs,
    Tab,
    TabList,
    TabPanel,
} from 'react-aria-components';
import { useIndicator } from '@/hooks/use-indicator';
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
    // `underline` (padrão): linha sob a aba marcada, para vistas grandes; `pill`: trilho com
    // marcador deslizante, o mesmo visual dos segmentos, para trocar entre visões de um bloco.
    variant?: 'underline' | 'pill';
    className?: string;
    children: (id: T) => ReactNode;
};

export function Tabs<T extends string>({
    label,
    items,
    selected,
    onChange,
    variant = 'underline',
    className,
    children,
}: TabsProps<T>) {
    const pill = variant === 'pill';
    const { ref, box } = useIndicator<HTMLDivElement>(selected);

    return (
        <AriaTabs
            selectedKey={selected}
            onSelectionChange={(key: Key) => onChange(key as T)}
            className={cn('flex min-h-0 flex-col', className)}
        >
            {/* O marcador fica fora do `TabList`: o React Aria só aceita abas ali dentro. O invólucro
                rola no lugar da lista, e o marcador rola junto. */}
            <div
                ref={ref}
                className={cn(
                    'relative overflow-x-auto',
                    pill
                        ? 'w-fit max-w-full rounded-lg bg-raised p-0.5'
                        : 'border-b border-border',
                )}
            >
                {box !== null && (
                    <span
                        aria-hidden="true"
                        className={cn(
                            'pointer-events-none absolute left-0 motion-safe:transition-[transform,width,height] motion-safe:duration-200 motion-safe:ease-out',
                            pill
                                ? 'top-0 rounded-md bg-surface shadow-sm ring-1 ring-border'
                                : 'bottom-0 h-0.5 rounded-full bg-accent',
                        )}
                        style={
                            pill
                                ? {
                                      width: box.w,
                                      height: box.h,
                                      transform: `translate(${box.x}px, ${box.y}px)`,
                                  }
                                : {
                                      width: box.w,
                                      transform: `translateX(${box.x}px)`,
                                  }
                        }
                    />
                )}
                <TabList
                    aria-label={label}
                    className={cn(
                        'flex w-max min-w-full',
                        pill ? 'gap-0.5' : 'gap-1',
                    )}
                >
                    {items.map((item) => (
                        <Tab
                            key={item.id}
                            id={item.id}
                            isDisabled={item.disabled}
                            className={cn(
                                'relative z-10 shrink-0 cursor-default font-medium whitespace-nowrap text-muted outline-none motion-safe:transition-colors data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-accent data-[hovered]:text-foreground data-[selected]:text-foreground data-[disabled]:text-disabled',
                                pill
                                    ? 'h-7 flex-1 rounded-md px-3 text-[13px] leading-7 data-[focus-visible]:outline-offset-1'
                                    : 'h-[34px] rounded-t-sm px-3 text-[13px] leading-[34px] data-[focus-visible]:-outline-offset-2',
                            )}
                        >
                            {item.label}
                        </Tab>
                    ))}
                </TabList>
            </div>
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
