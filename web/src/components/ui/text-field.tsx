import { FieldError, Input, Label, Text, TextField } from 'react-aria-components';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type TextInputProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    maxLength?: number;
    hint?: string;
    // Texto do erro; presente = campo inválido.
    error?: string;
    required?: boolean;
    disabled?: boolean;
    type?: 'text' | 'email';
    autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete'];
    className?: string;
};

// Campo de texto com rótulo visível, dica e erro ligados ao campo (React Aria `TextField`).
export function TextInput({
    label,
    value,
    onChange,
    maxLength,
    hint,
    error,
    required = false,
    disabled = false,
    type = 'text',
    autoComplete = 'off',
    className,
}: TextInputProps) {
    return (
        <TextField
            value={value}
            onChange={onChange}
            isInvalid={error !== undefined}
            isRequired={required}
            isDisabled={disabled}
            validationBehavior="aria"
            type={type}
            autoComplete={autoComplete}
            maxLength={maxLength}
            className={cn('group flex flex-col gap-1', className)}
        >
            <Label className="text-xs font-semibold text-muted">
                {label}
                {required && <span aria-hidden="true"> *</span>}
            </Label>
            <Input
                className={cn(
                    'h-[34px] rounded-md border bg-raised px-2.5 text-sm text-foreground outline-none focus:border-accent data-[disabled]:text-disabled',
                    error === undefined ? 'border-border' : 'border-status-error',
                )}
            />
            {hint !== undefined && (
                <Text slot="description" className="text-[11px] text-muted">
                    {hint}
                </Text>
            )}
            <FieldError className="text-[11px] text-status-error">
                {error}
            </FieldError>
        </TextField>
    );
}
