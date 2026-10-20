import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider } from 'react-aria-components';
import { initI18n } from '@/i18n';
import type { Locale } from '@/i18n';

export function renderWithProviders(
    ui: ReactElement,
    locale: Locale = 'pt-BR',
) {
    const i18n = initI18n(locale);
    void i18n.changeLanguage(locale);

    return render(<I18nProvider locale={locale}>{ui}</I18nProvider>);
}
