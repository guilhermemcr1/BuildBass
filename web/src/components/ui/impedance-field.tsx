import { useState } from 'react';
import { FieldError, Input, Label, Text, TextField, useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import {
    IMPEDANCE_MAX,
    IMPEDANCE_MIN,
    IMPEDANCE_SYMBOL,
    formatImpedance,
    isImpedance,
    parseVariant,
} from '@/lib/impedance';
import { cn } from '@/lib/utils';
import { FIELD_BOX, FIELD_INPUT, UnitAddon } from './field-box';

type ImpedanceFieldProps = {
    label: string;
    // O valor guardado ("4 Ω"); vazio = sem variação.
    value: string;
    onChange: (value: string) => void;
    hint?: string;
    placeholder?: string;
    disabled?: boolean;
    // Erro vindo de fora (validação do formulário); o próprio campo também aponta valor inválido.
    error?: string;
    className?: string;
};

// Campo da variação do driver: só o número em ohms, com o Ω fixo ao lado (como os demais campos
// com unidade); bobina dupla se digita "4+4". Letras e o símbolo são barrados ao digitar, e o valor
// é guardado como "4 Ω" ou "4+4 Ω". Um
// texto antigo fora desse padrão aparece como está e é apontado, para ser corrigido.
export function ImpedanceField({
    label,
    value,
    onChange,
    hint,
    placeholder,
    disabled = false,
    error,
    className,
}: ImpedanceFieldProps) {
    const { t } = useTranslation('common');
    const { locale } = useLocale();
    // Enquanto digita, vale o texto digitado ("4," ainda não é um número); ao sair, o guardado.
    const [draft, setDraft] = useState<string | undefined>();
    const variant = parseVariant(value);
    const number = (ohms: number) =>
        ohms.toLocaleString(locale, { maximumFractionDigits: 2 });
    const shown =
        draft ??
        (variant === null
            ? value
            : variant.coils === 2
              ? `${number(variant.ohms)}+${number(variant.ohms)}`
              : number(variant.ohms));
    const message =
        error ??
        (draft === undefined && !isImpedance(value)
            ? t('impedance.invalid', { min: IMPEDANCE_MIN, max: IMPEDANCE_MAX })
            : undefined);

    return (
        <TextField
            value={shown}
            onChange={(text) => {
                // Só dígitos, separador e o "+" da bobina dupla: letras e o Ω nunca entram.
                const clean = text.replace(/[^\d.,+]/g, '');

                setDraft(clean);
                onChange(formatImpedance(clean));
            }}
            onBlur={() => setDraft(undefined)}
            isInvalid={message !== undefined}
            isDisabled={disabled}
            validationBehavior="aria"
            inputMode="text"
            autoComplete="off"
            maxLength={13}
            className={cn('group flex flex-col gap-1', className)}
        >
            <Label className="text-xs font-semibold text-muted">{label}</Label>
            <div
                className={cn(
                    FIELD_BOX,
                    'group-data-[disabled]:opacity-60',
                    message !== undefined && 'border-status-error',
                )}
            >
                <Input
                    className={cn(FIELD_INPUT, 'num')}
                    placeholder={placeholder}
                />
                <UnitAddon symbol={IMPEDANCE_SYMBOL} />
            </div>
            {hint !== undefined && (
                <Text slot="description" className="text-[11px] text-muted">
                    {hint}
                </Text>
            )}
            <FieldError className="text-[11px] text-status-error">
                {message}
            </FieldError>
        </TextField>
    );
}
