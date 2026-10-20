import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { I18nProvider } from 'react-aria-components';
import i18n from '@/i18n';
import { usePreferences } from '@/stores/preferences';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function useThemeOnDocument() {
    const theme = usePreferences((state) => state.theme);

    useEffect(() => {
        const media = window.matchMedia(DARK_QUERY);
        const apply = () => {
            const resolved =
                theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
            document.documentElement.dataset.theme = resolved;
        };

        apply();

        if (theme !== 'system') {
            return;
        }

        media.addEventListener('change', apply);

        return () => media.removeEventListener('change', apply);
    }, [theme]);
}

function useLocaleOnDocument() {
    const locale = usePreferences((state) => state.locale);

    useEffect(() => {
        document.documentElement.lang = locale;

        if (i18n.language !== locale) {
            void i18n.changeLanguage(locale);
        }
    }, [locale]);

    return locale;
}

export function App({ children }: { children: ReactNode }) {
    useThemeOnDocument();
    const locale = useLocaleOnDocument();

    return <I18nProvider locale={locale}>{children}</I18nProvider>;
}
