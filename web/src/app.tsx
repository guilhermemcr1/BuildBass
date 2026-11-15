import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { I18nProvider } from 'react-aria-components';
import i18n from '@/i18n';
import { usePreferences } from '@/stores/preferences';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
// Um pouco mais que a transição de cor definida em `app.css` (`[data-theme-fade]`).
const THEME_FADE_MS = 400;

let fadeTimer: number | undefined;

// Troca o tema com as cores passando de uma para a outra, em vez de piscar. A marca só fica no
// documento durante a transição, para não deixar movimento nas interações normais.
function applyTheme(resolved: string) {
    const root = document.documentElement;
    const changing =
        root.dataset.theme !== undefined && root.dataset.theme !== resolved;

    if (changing && !window.matchMedia(REDUCED_MOTION_QUERY).matches) {
        root.dataset.themeFade = '';
        window.clearTimeout(fadeTimer);
        fadeTimer = window.setTimeout(() => {
            delete root.dataset.themeFade;
        }, THEME_FADE_MS);
    }

    root.dataset.theme = resolved;
}

function useThemeOnDocument() {
    const theme = usePreferences((state) => state.theme);

    useEffect(() => {
        const media = window.matchMedia(DARK_QUERY);
        const apply = () => {
            const resolved =
                theme === 'system' ? (media.matches ? 'dark' : 'light') : theme;
            applyTheme(resolved);
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
