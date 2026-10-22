import { useState } from 'react';
import { Input, TextField } from 'react-aria-components';
import { cn } from '@/lib/utils';

type InlineTextFieldProps = {
    label: string;
    value: string;
    maxLength?: number;
    // Enter ou sair do campo confirma; Esc cancela. Os dois encerram a edição.
    onCommit: (value: string) => void;
    onCancel: () => void;
    className?: string;
};

// Campo de texto para editar um nome no lugar (ex.: nome da aba, num balão).
export function InlineTextField({
    label,
    value,
    maxLength,
    onCommit,
    onCancel,
    className,
}: InlineTextFieldProps) {
    const [draft, setDraft] = useState(value);

    return (
        <TextField
            aria-label={label}
            value={draft}
            onChange={setDraft}
            maxLength={maxLength}
            autoFocus
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    onCommit(draft);
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancel();
                }
            }}
            onBlur={() => onCommit(draft)}
            className={className}
        >
            <Input
                className={cn(
                    'h-8 w-56 max-w-full rounded-md border border-accent bg-surface px-2 text-sm text-foreground outline-none',
                )}
                onFocus={(event) => event.currentTarget.select()}
            />
        </TextField>
    );
}
