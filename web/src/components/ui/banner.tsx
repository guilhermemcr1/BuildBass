import { Info, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BannerProps = {
    tone?: 'info' | 'warn';
    // Ícone no lugar do padrão do tom (aviso: triângulo; sem conexão passa WifiOff).
    icon?: LucideIcon;
    className?: string;
    children: ReactNode;
};

export function Banner({
    tone = 'info',
    icon,
    className,
    children,
}: BannerProps) {
    const Icon = icon ?? (tone === 'warn' ? TriangleAlert : Info);

    return (
        <div
            role="status"
            className={cn(
                'flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm',
                tone === 'warn'
                    ? 'bg-warn-bg text-warn-foreground'
                    : 'border border-border bg-surface text-foreground',
                className,
            )}
        >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <div>{children}</div>
        </div>
    );
}
