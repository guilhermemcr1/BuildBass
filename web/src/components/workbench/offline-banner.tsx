import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { useOnlineStatus } from '@/hooks/use-online-status';

export function OfflineBanner() {
    const { t } = useTranslation('workbench');

    if (useOnlineStatus() === 'online') {
        return null;
    }

    return (
        <Banner tone="warn" className="mx-3 mt-3">
            <strong>{t('offline.title')}</strong> {t('offline.body')}
        </Banner>
    );
}
