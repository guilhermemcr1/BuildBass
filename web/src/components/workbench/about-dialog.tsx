import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { CREDITS } from '@/lib/credits';

type AboutDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const LINK_CLASS =
    'inline-flex items-center gap-1.5 rounded-sm text-accent-soft underline underline-offset-2 outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function ExternalAnchor({
    href,
    children,
}: {
    href: string;
    children: ReactNode;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
        >
            {children}
            <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
    );
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
    const { t } = useTranslation(['workbench', 'common']);

    return (
        <Dialog
            title={t('about.title')}
            open={open}
            onOpenChange={onOpenChange}
        >
            <p className="text-sm text-muted">{t('about.tagline')}</p>
            <dl className="flex flex-col divide-y divide-border text-sm">
                <div className="flex flex-col gap-1 py-2.5">
                    <dt className="text-xs font-semibold text-muted">
                        {t('about.authorLabel')}
                    </dt>
                    <dd>
                        <strong>{CREDITS.author}</strong>
                        <span className="text-muted">
                            {' '}
                            · {t('about.authorRole')}
                        </span>
                    </dd>
                </div>
                <div className="flex flex-col gap-1 py-2.5">
                    <dt className="text-xs font-semibold text-muted">
                        {t('about.linksLabel')}
                    </dt>
                    <dd className="flex flex-wrap gap-x-4 gap-y-1">
                        <ExternalAnchor href={CREDITS.githubUrl}>
                            {t('about.github')}
                        </ExternalAnchor>
                        <ExternalAnchor href={CREDITS.portfolioUrl}>
                            {t('about.portfolio')}
                        </ExternalAnchor>
                        <ExternalAnchor href={CREDITS.repositoryUrl}>
                            {t('about.repository')}
                        </ExternalAnchor>
                    </dd>
                </div>
                <div className="flex flex-col gap-1 py-2.5">
                    <dt className="text-xs font-semibold text-muted">
                        {t('about.referencesLabel')}
                    </dt>
                    <dd>{t('about.references')}</dd>
                </div>
                <div className="flex flex-col gap-1 py-2.5">
                    <dt className="text-xs font-semibold text-muted">
                        {t('about.licenseLabel')}
                    </dt>
                    <dd>{t('about.license')}</dd>
                </div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <ExternalAnchor href={CREDITS.creditsUrl}>
                    {t('about.fullCredits')}
                </ExternalAnchor>
                <Button
                    variant="primary"
                    onPress={() => onOpenChange(false)}
                    autoFocus
                >
                    {t('common:comingSoon.close')}
                </Button>
            </div>
        </Dialog>
    );
}
