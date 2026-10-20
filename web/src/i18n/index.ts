import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en/common.json';
import enParameters from './locales/en/parameters.json';
import enWorkbench from './locales/en/workbench.json';
import ptCommon from './locales/pt-BR/common.json';
import ptParameters from './locales/pt-BR/parameters.json';
import ptWorkbench from './locales/pt-BR/workbench.json';

export type Locale = 'pt-BR' | 'en';

export const LOCALES: Locale[] = ['pt-BR', 'en'];

export const resources = {
    'pt-BR': {
        common: ptCommon,
        workbench: ptWorkbench,
        parameters: ptParameters,
    },
    en: { common: enCommon, workbench: enWorkbench, parameters: enParameters },
} as const;

export function detectLocale(language: string | undefined): Locale {
    return language !== undefined && /^en\b/i.test(language) ? 'en' : 'pt-BR';
}

export function initI18n(locale: Locale): typeof i18n {
    void i18n.use(initReactI18next).init({
        resources,
        lng: locale,
        fallbackLng: 'pt-BR',
        ns: ['common', 'workbench', 'parameters'],
        defaultNS: 'common',
        interpolation: { escapeValue: false },
        returnNull: false,
    });

    return i18n;
}

export default i18n;
