import { useTranslation } from 'react-i18next';
import { Flag } from '@/components/ui/flag';
import type { FlagCountry } from '@/components/ui/flag';
import { Menu } from '@/components/ui/menu';
import { LOCALES } from '@/i18n';
import type { Locale } from '@/i18n';
import { usePreferences } from '@/stores/preferences';

// Idioma com a bandeira ao lado do texto: BR (Brasil) e EN (Estados Unidos). A bandeira só enfeita;
// o código no botão e o nome por extenso no menu continuam sendo o que se lê.
const FLAGS: Record<Locale, { code: string; country: FlagCountry }> = {
    'pt-BR': { code: 'BR', country: 'br' },
    en: { code: 'EN', country: 'us' },
};

export function LanguageSwitch() {
    const { t } = useTranslation('common');
    const locale = usePreferences((state) => state.locale);
    const setLocale = usePreferences((state) => state.setLocale);
    const { code, country } = FLAGS[locale];

    return (
        <Menu<Locale>
            label={t('language.label')}
            triggerLabel={t('language.current', { code })}
            selected={locale}
            onAction={setLocale}
            items={LOCALES.map((id) => ({
                id,
                label: t(`language.${id}`),
                icon: <Flag country={FLAGS[id].country} />,
            }))}
            trigger={
                <span className="flex h-8 items-center gap-2 rounded-md border border-border bg-raised px-2.5 text-[13px] text-foreground">
                    <Flag country={country} />
                    {code}
                </span>
            }
        />
    );
}
