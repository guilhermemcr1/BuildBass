import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    Button,
    Disclosure,
    DisclosurePanel,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { SectionId } from '@/lib/parameters';
import { useExpanded } from '@/stores/expanded';
import { cn } from '@/lib/utils';

type ShowMoreProps = {
    id: SectionId;
    // Quantos campos avançados já têm valor: o botão avisa com texto quando a seção está recolhida
    // (FR-031). Valores recolhidos continuam valendo nos cálculos.
    filled?: number;
    children: ReactNode;
};

// Agrupa campos não essenciais atrás de "Mostrar mais" / "Mostrar menos" (disclosure do React
// Aria: `aria-expanded`, Enter/Espaço, conteúdo recolhido fora da árvore de acessibilidade).
// Quem abre e fecha é o `useExpanded`, que o modo Normal/Pro comanda.
export function ShowMore({ id, filled = 0, children }: ShowMoreProps) {
    const { t } = useTranslation('common');
    const expanded = useExpanded((state) => state.open[id]);
    const toggle = useExpanded((state) => state.toggle);

    return (
        <Disclosure
            isExpanded={expanded}
            onExpandedChange={() => toggle(id)}
            className="group/more flex flex-col gap-3"
        >
            <Button
                slot="trigger"
                className="flex h-7 w-fit cursor-default items-center gap-1.5 rounded-md px-1.5 text-xs font-semibold text-muted outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:text-foreground"
            >
                <ChevronDown
                    aria-hidden="true"
                    className={cn(
                        'size-3.5 motion-safe:transition-transform',
                        expanded && 'rotate-180',
                    )}
                />
                {expanded ? t('showMore.less') : t('showMore.more')}
                {!expanded && filled > 0 && (
                    <>
                        {/* Espaço de verdade: o nome acessível não ganha o `gap` do flex. */}
                        {' '}
                        <span className="font-normal">
                            {t('showMore.filled', { count: filled })}
                        </span>
                    </>
                )}
            </Button>
            <DisclosurePanel className="flex flex-col gap-3">
                {children}
            </DisclosurePanel>
        </Disclosure>
    );
}
