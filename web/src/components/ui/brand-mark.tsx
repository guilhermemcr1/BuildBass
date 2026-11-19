import { cn } from '@/lib/utils';

// Marca do BuildBass (a mesma do README e do favicon): cone de alto-falante visto de frente. Cores
// fixas, para sair igual na tela, em qualquer tema, e no papel.
export function BrandMark({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 120 120"
            aria-hidden="true"
            className={cn('shrink-0', className)}
        >
            <rect width="120" height="120" rx="26" fill="#121212" />
            <circle
                cx="60"
                cy="60"
                r="40"
                fill="none"
                stroke="#b8f53d"
                strokeWidth="8"
            />
            <circle
                cx="60"
                cy="60"
                r="26"
                fill="none"
                stroke="#b8f53d"
                strokeOpacity=".45"
                strokeWidth="3.5"
            />
            <circle cx="60" cy="60" r="14" fill="#b8f53d" />
        </svg>
    );
}
