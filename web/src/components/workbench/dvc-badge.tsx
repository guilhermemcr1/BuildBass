import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

// Selo de bobina dupla: o "4+4 Ω" sozinho passa despercebido, e a ligação das bobinas muda a carga
// no amplificador.
export function DvcBadge({ className }: { className?: string }) {
    const { t } = useTranslation('workbench');

    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center rounded border border-accent/40 bg-accent/10 px-1.5 text-[11px] leading-4 font-semibold text-accent',
                className,
            )}
        >
            {t('dvc.badge')}
        </span>
    );
}
