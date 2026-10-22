import { useId } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type Region = 'driver' | 'box' | 'charts' | 'plan' | 'results';

type PanelProps = {
    region: Region;
    title: string;
    actions?: ReactNode;
    // Na lateral (≥ 1280 px) o painel vira seção de uma superfície só: sem cartão, separado por
    // linha. Abaixo disso continua cartão.
    flush?: boolean;
    className?: string;
    children: ReactNode;
};

export function Panel({
    region,
    title,
    actions,
    flush = false,
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
                flush &&
                    'xl:rounded-none xl:border-0 xl:border-t xl:bg-transparent xl:px-4 xl:py-3.5',
                className,
            )}
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
