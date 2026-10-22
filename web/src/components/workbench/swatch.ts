import type { SeriesColor } from '@/lib/project/types';

// Cor de cada projeto aberto (tokens --series-N), na aba, na legenda e na tabela. As seis classes
// ficam escritas por extenso para o Tailwind encontrá-las.
export const SWATCH: Record<SeriesColor, string> = {
    1: 'bg-series-1',
    2: 'bg-series-2',
    3: 'bg-series-3',
    4: 'bg-series-4',
    5: 'bg-series-5',
    6: 'bg-series-6',
};
