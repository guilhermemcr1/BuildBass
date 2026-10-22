import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Button, Disclosure, DisclosurePanel } from 'react-aria-components';
import { cn } from '@/lib/utils';

export type Region = 'driver' | 'box' | 'charts' | 'plan' | 'results';

type Collapsible = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Texto curto ao lado do título, visível também com o painel recolhido.
    summary?: string;
};

type PanelProps = {
    region: Region;
    title: string;
    actions?: ReactNode;
    // Na lateral (≥ 1280 px) o painel vira seção de uma superfície só: sem cartão, separado por
    // linha. Abaixo disso continua cartão.
    flush?: boolean;
    // Painel que abre e fecha pelo título (disclosure do React Aria: `aria-expanded`, Enter/Espaço).
    collapsible?: Collapsible;
    className?: string;
    children: ReactNode;
};

export function Panel({
    region,
    title,
    actions,
    flush = false,
    collapsible,
    className,
    children,
}: PanelProps) {
    const headingId = useId();
    const classes = cn(
        'flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4',
        flush &&
            'xl:rounded-none xl:border-0 xl:border-t xl:bg-transparent xl:px-4 xl:py-3.5',
        className,
    );

    if (collapsible !== undefined) {
        return (
            <section
                aria-labelledby={headingId}
                data-region={region}
                className={classes}
            >
                <Disclosure
                    isExpanded={collapsible.open}
                    onExpandedChange={collapsible.onOpenChange}
                    className="flex flex-col"
                >
                    <header className="flex min-h-8 items-center justify-between gap-3">
                        <h2 id={headingId} className="min-w-0">
                            <Button
                                slot="trigger"
                                className="group/trigger flex h-8 cursor-default items-center gap-1.5 rounded-md pr-2 text-section outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:text-foreground motion-safe:transition-colors"
                            >
                                <ChevronDown
                                    aria-hidden="true"
                                    className={cn(
                                        'size-4 motion-safe:transition-transform',
                                        !collapsible.open && '-rotate-90',
                                    )}
                                />
                                {title}
                            </Button>
                        </h2>
                        {collapsible.summary !== undefined && (
                            <span className="min-w-0 flex-1 truncate text-right num text-xs text-muted">
                                {collapsible.summary}
                            </span>
                        )}
                        {actions}
                    </header>
                    <DisclosurePanel className="disclosure-motion">
                        <div className="flex flex-col gap-3 pt-3">
                            {children}
                        </div>
                    </DisclosurePanel>
                </Disclosure>
            </section>
        );
    }

    return (
        <section
            aria-labelledby={headingId}
            data-region={region}
            className={classes}
        >
            <header className="flex min-h-8 items-center justify-between gap-2">
                <h2 id={headingId} className="text-section">
                    {title}
                </h2>
                {actions}
            </header>
            {children}
        </section>
    );
}
