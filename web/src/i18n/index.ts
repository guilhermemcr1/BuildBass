import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from './locales/en/common.json';
import enCutplan from './locales/en/cutplan.json';
import enEngine from './locales/en/engine.json';
import enParameters from './locales/en/parameters.json';
import enProject from './locales/en/project.json';
import enSubmission from './locales/en/submission.json';
import enTutorial from './locales/en/tutorial.json';
import enWorkbench from './locales/en/workbench.json';
import ptCommon from './locales/pt-BR/common.json';
import ptCutplan from './locales/pt-BR/cutplan.json';
import ptEngine from './locales/pt-BR/engine.json';
import ptParameters from './locales/pt-BR/parameters.json';
import ptProject from './locales/pt-BR/project.json';
import ptSubmission from './locales/pt-BR/submission.json';
import ptTutorial from './locales/pt-BR/tutorial.json';
import ptWorkbench from './locales/pt-BR/workbench.json';

export type Locale = 'pt-BR' | 'en';

export const LOCALES: Locale[] = ['pt-BR', 'en'];

export const resources = {
    'pt-BR': {
        common: ptCommon,
        workbench: ptWorkbench,
        parameters: ptParameters,
        project: ptProject,
        engine: ptEngine,
        cutplan: ptCutplan,
        submission: ptSubmission,
        tutorial: ptTutorial,
    },
    en: {
        common: enCommon,
        workbench: enWorkbench,
        parameters: enParameters,
        project: enProject,
        engine: enEngine,
        cutplan: enCutplan,
        submission: enSubmission,
        tutorial: enTutorial,
    },
} as const;

export function detectLocale(language: string | undefined): Locale {
    return language !== undefined && /^en\b/i.test(language) ? 'en' : 'pt-BR';
}

export function initI18n(locale: Locale): typeof i18n {
    void i18n.use(initReactI18next).init({
        resources,
        lng: locale,
        fallbackLng: 'pt-BR',
        ns: [
            'common',
            'workbench',
            'parameters',
            'project',
            'engine',
            'cutplan',
            'submission',
            'tutorial',
        ],
        defaultNS: 'common',
        interpolation: { escapeValue: false },
        returnNull: false,
    });

    return i18n;
}

export default i18n;
