import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { I18nProvider } from 'react-aria-components';
import i18n from '@/i18n';
import { usePreferences } from '@/stores/preferences';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type ViewTransitionDocument = Document & {
    startViewTransition?: (update: () => void) => unknown;
};

// Troca o tema com um crossfade da página inteira (View Transitions): o navegador tira um retrato
// do tema antigo e funde com o novo na GPU, em vez de transicionar a cor de cada elemento, o que
// travava em telas cheias (gráfico, tabelas). Sem suporte ou com movimento reduzido, troca direto.
function applyTheme(resolved: string) {
    const root = document.documentElement;

    if (root.dataset.theme === resolved) {
        return;
    }

    const doc = document as ViewTransitionDocument;
    const update = () => {
        root.dataset.theme = resolved;
    };

    if (
        root.dataset.theme === undefined ||
        typeof doc.startViewTransition !== 'function' ||
        window.matchMedia(REDUCED_MOTION_QUERY).matches
    ) {
        update();

        return;
    }

    doc.startViewTransition(update);
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
