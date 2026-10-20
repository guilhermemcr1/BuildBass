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

// Campo de texto que aparece no lugar de um rótulo enquanto ele é editado (ex.: nome da aba).
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
                    'h-7 w-40 rounded-sm border border-accent bg-surface px-1.5 text-sm text-foreground outline-none',
                )}
                onFocus={(event) => event.currentTarget.select()}
            />
        </TextField>
    );
}
