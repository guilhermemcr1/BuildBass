import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Menu } from '@/components/ui/menu';
import { LOCALES } from '@/i18n';
import type { Locale } from '@/i18n';
import { usePreferences } from '@/stores/preferences';

export function LanguageSwitch() {
    const { t } = useTranslation('common');
    const locale = usePreferences((state) => state.locale);
    const setLocale = usePreferences((state) => state.setLocale);
    const code = locale === 'en' ? 'EN' : 'PT';

    return (
        <Menu<Locale>
            label={t('language.label')}
            triggerLabel={t('language.current', { code })}
            selected={locale}
            onAction={setLocale}
            items={LOCALES.map((id) => ({ id, label: t(`language.${id}`) }))}
            trigger={
                <span className="flex h-[34px] items-center gap-1.5 rounded-md border border-border bg-raised px-2.5 text-[13px] text-foreground">
                    <Languages aria-hidden="true" className="size-4" />
                    {code}
                </span>
            }
        />
    );
}
