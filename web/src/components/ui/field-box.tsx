import { cn } from '@/lib/utils';

// Caixa de campo única da bancada: 32 px, fundo "raised", borda que acende no foco. Todo campo de
// texto, número e busca usa estas classes para não haver um desenho por tela.
export const FIELD_BOX =
    'flex h-8 min-w-0 items-stretch overflow-hidden rounded-md border border-border bg-raised text-sm text-foreground outline-none motion-safe:transition-colors focus-within:border-accent focus-within:bg-surface';

export const FIELD_INPUT =
    'h-full w-full min-w-0 bg-transparent px-2.5 text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed';

// Unidade fixa à direita do valor, separada por divisória (o mesmo desenho do `ParameterField`).
export function UnitAddon({ symbol }: { symbol: string }) {
    if (symbol === '') {
        return null;
    }

    return (
        <span
            className={cn(
                'flex min-w-9 shrink-0 items-center justify-center border-l border-border bg-background/60 px-2 text-xs text-muted',
            )}
        >
            {symbol}
        </span>
    );
}
