import {
    ChevronRight,
    FileUp,
    PencilLine,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export type SubmitPath = 'manual' | 'fields';

type SubmitChoiceProps = {
    onChoose: (path: SubmitPath) => void;
    onCancel: () => void;
};

const OPTIONS: {
    path: SubmitPath;
    icon: LucideIcon;
    badgeIcon?: LucideIcon;
}[] = [
    { path: 'manual', icon: FileUp, badgeIcon: Sparkles },
    { path: 'fields', icon: PencilLine },
];

// Primeira etapa do envio: anexar o manual (a IA preenche) ou digitar os campos.
export function SubmitChoice({ onChoose, onCancel }: SubmitChoiceProps) {
    const { t } = useTranslation('submission');

    return (
        <div className="flex flex-col gap-5">
            <header className="flex rise flex-col gap-1">
                <h3 className="text-base font-semibold">{t('choice.title')}</h3>
                <p className="text-sm text-muted">{t('choice.subtitle')}</p>
            </header>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {OPTIONS.map(
                    ({ path, icon: Icon, badgeIcon: BadgeIcon }, index) => (
                        <AriaButton
                            key={path}
                            onPress={() => onChoose(path)}
                            style={
                                {
                                    '--rise-delay': `${60 + index * 70}ms`,
                                } as CSSProperties
                            }
                            className="group relative flex rise flex-col items-start gap-3 overflow-hidden rounded-xl border border-border bg-raised/40 p-5 text-left outline-none hover:-translate-y-0.5 hover:border-accent/60 hover:bg-accent/5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-accent data-[pressed]:translate-y-0 data-[pressed]:scale-[0.99] motion-safe:transition-[border-color,background-color,transform,box-shadow] motion-safe:duration-200"
                        >
                            {/* Brilho suave que acende no hover. */}
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-accent/10 opacity-0 blur-2xl group-hover:opacity-100 motion-safe:transition-opacity motion-safe:duration-300"
                            />
                            <div className="flex w-full items-center justify-between gap-2">
                                <span
                                    aria-hidden="true"
                                    className="grid size-11 place-items-center rounded-lg bg-accent/15 text-accent-soft group-hover:scale-110 motion-safe:transition-transform motion-safe:duration-200"
                                >
                                    <Icon className="size-5" />
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted">
                                    {BadgeIcon !== undefined && (
                                        <BadgeIcon
                                            aria-hidden="true"
                                            className="size-3 text-accent-soft"
                                        />
                                    )}
                                    {t(`choice.${path}Badge`)}
                                </span>
                            </div>
                            <span className="flex w-full items-center justify-between gap-2">
                                <span className="text-sm font-semibold">
                                    {t(`choice.${path}`)}
                                </span>
                                <ChevronRight
                                    aria-hidden="true"
                                    className="size-4 shrink-0 text-muted group-hover:translate-x-1 group-hover:text-accent-soft motion-safe:transition-transform motion-safe:duration-200"
                                />
                            </span>
                            <span className="text-xs leading-relaxed text-muted">
                                {t(`choice.${path}Hint`)}
                            </span>
                        </AriaButton>
                    ),
                )}
            </div>
            <div
                className="flex rise flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
                style={{ '--rise-delay': '220ms' } as CSSProperties}
            >
                <p className="flex items-center gap-1.5 text-xs text-muted">
                    <ShieldCheck
                        aria-hidden="true"
                        className="size-4 shrink-0 text-status-ok"
                    />
                    {t('choice.review')}
                </p>
                <Button variant="quiet" onPress={onCancel}>
                    {t('actions.cancel')}
                </Button>
            </div>
        </div>
    );
}
