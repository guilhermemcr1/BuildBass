import type { SeriesColor } from '@/lib/project/types';

// Cores de papel: a imagem exportada tem fundo branco qualquer que seja o tema da tela. Os valores
// espelham o tema claro de styles/app.css (um teste confere); ficam aqui, fora de componente,
// porque um arquivo não tem tema para ler.
export const PAPER = {
    background: '#ffffff',
    text: '#161616',
    muted: '#5c5c57',
    grid: '#d6d6d1',
    warn: '#875a00',
    error: '#cf222e',
} as const;

export const SERIES_PAPER: Record<SeriesColor, string> = {
    1: '#4d7c0f',
    2: '#b85a00',
    3: '#8250df',
    4: '#1f6feb',
    5: '#c2255c',
    6: '#0e7490',
};
