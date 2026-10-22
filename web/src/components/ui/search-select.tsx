import { Loader2, Search } from 'lucide-react';
import type { Key, ReactNode, Ref } from 'react';
import {
    ComboBox,
    Input,
    Label,
    ListBox,
    ListBoxItem,
    Popover,
    Text,
} from 'react-aria-components';
import { cn } from '@/lib/utils';
import { FIELD_BOX } from './field-box';

export type SearchOption = {
    id: string;
    label: string;
    // Segunda linha do item (ex.: Fs, Qts e Vas do driver).
    description?: string;
};

type SearchSelectProps = {
    label: string;
    placeholder?: string;
    items: SearchOption[];
    onSelect: (id: string) => void;
    disabled?: boolean;
    disabledReason?: string;
    className?: string;
    // Modo assíncrono: quem usa controla o texto e entrega os itens já filtrados (o servidor
    // filtrou), então o ComboBox não filtra de novo. Sem `inputValue`, filtra a lista estática.
    inputValue?: string;
    onInputChange?: (value: string) => void;
    loading?: boolean;
    // Abre a lista mesmo sem itens (enquanto a busca roda ou para mostrar `emptyMessage`). Deve ser
    // falso quando não há busca em curso, senão limpar o campo reabriria a lista vazia.
    openWhenEmpty?: boolean;
    // Texto no lugar da lista quando não há itens (buscando, nenhum resultado, erro).
    emptyMessage?: string;
    // Linha de estado sob o campo (carregando, vazio, erro, aviso): região viva, fora da lista, para
    // poder ter botões e continuar visível com a lista fechada.
    status?: ReactNode;
    inputRef?: Ref<HTMLInputElement>;
};

export function SearchSelect({
    label,
    placeholder,
    items,
    onSelect,
    disabled = false,
    disabledReason,
    className,
    inputValue,
    onInputChange,
    loading = false,
    openWhenEmpty = false,
    emptyMessage,
    status,
    inputRef,
}: SearchSelectProps) {
    const remote = inputValue !== undefined;
    const Icon = loading ? Loader2 : Search;

    return (
        <div className={cn('flex flex-col gap-1', className)}>
            <ComboBox
                {...(remote
                    ? {
                          items,
                          inputValue,
                          onInputChange,
                          // O texto digitado fica ao sair do campo (ex.: para "Tentar de novo") e a
                          // seleção nunca "gruda": escolher o mesmo item de novo funciona.
                          allowsCustomValue: true,
                          // Abre ao digitar mesmo antes de os itens chegarem do servidor.
                          allowsEmptyCollection: openWhenEmpty,
                          selectedKey: null,
                          menuTrigger: 'focus' as const,
                      }
                    : { defaultItems: items, menuTrigger: 'focus' as const })}
                isDisabled={disabled}
                onSelectionChange={(key: Key | null) => {
                    if (key !== null) {
                        onSelect(String(key));
                    }
                }}
                className="group flex flex-col gap-1"
            >
                <Label className="text-xs font-semibold text-muted">
                    {label}
                </Label>
                <div
                    className={cn(
                        FIELD_BOX,
                        'items-center gap-2 px-2.5 group-data-[disabled]:opacity-60',
                    )}
                >
                    <Icon
                        aria-hidden="true"
                        className={cn(
                            'size-4 shrink-0 text-muted',
                            loading && 'animate-spin',
                        )}
                    />
                    <Input
                        ref={inputRef}
                        placeholder={placeholder}
                        className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed"
                    />
                </div>
                {disabled && disabledReason !== undefined && (
                    <Text slot="description" className="text-[11px] text-muted">
                        {disabledReason}
                    </Text>
                )}
                <Popover
                    className={cn(
                        'pop w-(--trigger-width) rounded-md border border-border bg-raised p-1 shadow-lg',
                        items.length === 0 &&
                            emptyMessage === undefined &&
                            'hidden',
                    )}
                >
                    <ListBox<SearchOption>
                        renderEmptyState={() => (
                            <div className="px-2.5 py-1.5 text-sm text-muted">
                                {emptyMessage}
                            </div>
                        )}
                        className="max-h-64 overflow-auto outline-none"
                    >
                        {(item) => (
                            <ListBoxItem
                                id={item.id}
                                textValue={item.label}
                                className="cursor-default rounded-sm px-2.5 py-1.5 text-sm outline-none data-[focused]:bg-surface"
                            >
                                <span className="block">{item.label}</span>
                                {item.description !== undefined && (
                                    <span className="block text-[11px] text-muted tabular-nums">
                                        {item.description}
                                    </span>
                                )}
                            </ListBoxItem>
                        )}
                    </ListBox>
                </Popover>
            </ComboBox>
            <div
                role="status"
                aria-live="polite"
                className="text-[11px] text-muted empty:hidden"
            >
                {status}
            </div>
        </div>
    );
}
