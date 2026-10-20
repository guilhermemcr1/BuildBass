import { CircleCheck, CircleDashed, CircleX, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type FieldStatus = 'none' | 'ok' | 'warn' | 'error' | 'unchecked';

const APPEARANCE: Record<
    Exclude<FieldStatus, 'none'>,
    { icon: LucideIcon; color: string }
> = {
    ok: { icon: CircleCheck, color: 'text-status-ok' },
    warn: { icon: TriangleAlert, color: 'text-status-warn' },
    error: { icon: CircleX, color: 'text-status-error' },
    unchecked: { icon: CircleDashed, color: 'text-muted' },
};

type StatusIndicatorProps = {
    status: FieldStatus;
    label?: string;
    className?: string;
};

// Status sempre com ícone + texto, nunca só por cor (constituição, Padrões de Interface).
export function StatusIndicator({
    status,
    label,
    className,
}: StatusIndicatorProps) {
    const { t } = useTranslation('common');

    if (status === 'none') {
        return null;
    }

    const { icon: Icon, color } = APPEARANCE[status];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 text-xs',
                color,
                className,
            )}
        >
            <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />
            <span>{label ?? t(`status.${status}`)}</span>
        </span>
    );
}
