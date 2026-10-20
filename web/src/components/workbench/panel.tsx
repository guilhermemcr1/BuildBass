import { useId } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Region = 'driver' | 'box' | 'charts' | 'results';

type PanelProps = {
    region: Region;
    title: string;
    actions?: ReactNode;
    className?: string;
    children: ReactNode;
};

export function Panel({
    region,
    title,
    actions,
    className,
    children,
}: PanelProps) {
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            data-region={region}
            className={cn(
                'flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4',
                className,
            )}
        >
            <header className="flex items-center justify-between gap-2">
                <h2 id={headingId} className="text-section">
                    {title}
                </h2>
                {actions}
            </header>
            {children}
        </section>
    );
}
