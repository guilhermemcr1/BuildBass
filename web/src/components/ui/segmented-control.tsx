import type { Key, ReactNode } from 'react';
import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { useIndicator } from '@/hooks/use-indicator';
import { cn } from '@/lib/utils';

export type SegmentOption<T extends string> = {
    id: T;
    label: string;
    // Enfeite antes do texto; deve ser `aria-hidden`, o nome acessível é o `label`.
    icon?: ReactNode;
    // Texto curto na tela quando o nome acessível é mais longo (ex.: "mm" para "Métrico").
    short?: string;
    // Só o ícone na tela; o `label` segue como nome acessível e como dica.
    iconOnly?: boolean;
    disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
    label: string;
    options: SegmentOption<T>[];
    selected: T;
    onChange: (id: T) => void;
    // `sm` para os grupos dentro dos painéis (ligação, sinal, duto): mais baixo e com texto menor.
    size?: 'md' | 'sm';
    // `tiles`: cada opção é um bloco com borda e o marcador é o contorno da escolhida (opções
    // longas ou em duas linhas); `pill` (padrão): trilho único com marcador deslizante.
    variant?: 'pill' | 'tiles';
    className?: string;
};

export function SegmentedControl<T extends string>({
    label,
    options,
    selected,
    onChange,
    size = 'md',
    variant = 'pill',
    className,
}: SegmentedControlProps<T>) {
    const { ref, box } = useIndicator<HTMLDivElement>(selected);

    return (
        <ToggleButtonGroup
            ref={ref}
            aria-label={label}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[selected]}
            onSelectionChange={(keys: Set<Key>) => {
                const [first] = keys;

                if (first !== undefined) {
                    onChange(first as T);
                }
            }}
            className={cn(
                variant === 'pill'
                    ? 'relative inline-flex flex-wrap gap-0.5 rounded-lg bg-raised p-0.5'
                    : 'relative inline-flex flex-wrap gap-1.5',
                className,
            )}
        >
            {/* Marcador que desliza até a opção marcada; o botão marcado só muda a cor do texto. */}
            {box !== null && (
                <span
                    aria-hidden="true"
                    className={cn(
                        'pointer-events-none absolute top-0 left-0 motion-safe:transition-[transform,width,height] motion-safe:duration-200 motion-safe:ease-out',
                        variant === 'pill'
                            ? 'rounded-md bg-surface shadow-sm ring-1 ring-border'
                            : 'rounded-md bg-accent/10 ring-1 ring-accent',
                    )}
                    style={{
                        width: box.w,
                        height: box.h,
                        transform: `translate(${box.x}px, ${box.y}px)`,
                    }}
                />
            )}
            {options.map((option) => (
                <ToggleButton
                    key={option.id}
                    id={option.id}
                    isDisabled={option.disabled}
                    className={cn(
                        variant === 'tiles' &&
                            'border border-border data-[selected]:border-transparent data-[hovered]:bg-raised',
                        'relative z-10 flex-1 cursor-default rounded-md whitespace-nowrap text-muted outline-none motion-safe:transition-colors data-[disabled]:text-disabled data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-accent data-[hovered]:text-foreground data-[selected]:text-foreground',
                        variant === 'tiles'
                            ? 'h-8 px-2 text-xs'
                            : size === 'sm'
                              ? 'h-6 px-2 text-xs'
                              : 'h-7 px-2.5 text-[13px]',
                    )}
                >
                    {option.iconOnly === true ? (
                        <>
                            <span className="flex items-center justify-center">
                                {option.icon}
                            </span>
                            <span className="sr-only">{option.label}</span>
                        </>
                    ) : option.short !== undefined ? (
                        <>
                            <span aria-hidden="true">{option.short}</span>
                            <span className="sr-only">{option.label}</span>
                        </>
                    ) : option.icon === undefined ? (
                        option.label
                    ) : (
                        <span className="flex items-center justify-center gap-1.5">
                            {option.icon}
                            {option.label}
                        </span>
                    )}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
