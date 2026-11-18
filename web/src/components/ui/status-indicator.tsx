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
    // Texto visível do modo `compact`, no lugar do curto padrão.
    shortLabel?: string;
    className?: string;
    // `compact`: texto curto e menor para os campos de parâmetro; o rótulo
    // completo continua disponível ao leitor de tela.
    size?: 'default' | 'compact';
};

// Status sempre com ícone + texto, nunca só por cor (constituição, Padrões de Interface).
export function StatusIndicator({
    status,
    label,
    shortLabel,
    className,
    size = 'default',
}: StatusIndicatorProps) {
    const { t } = useTranslation('common');

    if (status === 'none') {
        return null;
    }

    const { icon: Icon, color } = APPEARANCE[status];
    const compact = size === 'compact';
    const full = label ?? t(`status.${status}`);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1',
                compact ? 'text-[11px] leading-4' : 'text-xs',
                color,
                className,
            )}
        >
            <Icon
                aria-hidden="true"
                className={cn('shrink-0', compact ? 'size-3' : 'size-3.5')}
                strokeWidth={2.5}
            />
            {compact ? (
                <>
                    <span aria-hidden="true">{shortLabel ?? t(`status.short.${status}`)}</span>
                    <span className="sr-only">{full}</span>
                </>
            ) : (
                <span>{full}</span>
            )}
        </span>
    );
}
