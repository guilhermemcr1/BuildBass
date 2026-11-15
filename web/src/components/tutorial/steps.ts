import type { Side } from './placement';

export type TutorialStep = {
    // Chave em `tutorial:steps.<id>`.
    id: string;
    // Seletor do que destacar; sem ele o passo é um cartão no meio da tela.
    target?: string;
    // Lados preferidos para o cartão, do melhor para o pior.
    sides?: Side[];
};

// A ordem segue o caminho de uma simulação: projeto → driver → caixa → resultados → gráficos →
// plano de corte → salvar → preferências.
export const STEPS: TutorialStep[] = [
    { id: 'welcome' },
    { id: 'tabs', target: '[data-tour="tabs"]', sides: ['bottom', 'right'] },
    {
        id: 'driver',
        target: '[data-region="driver"]',
        sides: ['right', 'bottom'],
    },
    {
        id: 'driverExpand',
        target: '[data-tour="driver-expand"]',
        sides: ['bottom', 'right'],
    },
    { id: 'box', target: '[data-region="box"]', sides: ['right', 'bottom'] },
    {
        id: 'results',
        target: '[data-region="results"]',
        sides: ['bottom', 'top'],
    },
    {
        id: 'charts',
        target: '[data-region="charts"]',
        sides: ['top', 'bottom'],
    },
    { id: 'plan', target: '[data-region="plan"]', sides: ['top', 'bottom'] },
    {
        id: 'actions',
        target: '[data-tour="actions"]',
        sides: ['bottom', 'right'],
    },
    {
        id: 'preferences',
        target: '[data-tour="preferences"]',
        sides: ['bottom', 'left'],
    },
    { id: 'done' },
];
