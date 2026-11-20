import { useState } from 'react';
import { SegmentedControl } from './segmented-control';
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

// Campo da variação do driver: o número em ohms de uma bobina, com o Ω fixo ao lado, e a caixa
// "Bobina dupla". Letras, o símbolo e o "+" são barrados ao digitar; o valor continua guardado como
// "4 Ω" ou "4+4 Ω" (formato do catálogo e dos arquivos), mas é sempre o sistema que o escreve.
// Um texto antigo fora desse padrão aparece como está e é apontado, para ser corrigido.
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
    // A caixa marcada sem número ainda precisa ser lembrada até o número chegar.
    const [dualWhenEmpty, setDualWhenEmpty] = useState(false);
    const dual = variant === null ? dualWhenEmpty : variant.coils === 2;
    const number = (ohms: number) =>
        ohms.toLocaleString(locale, { maximumFractionDigits: 2 });
    const shown = draft ?? (variant === null ? value : number(variant.ohms));
    const message =
        error ??
        (draft === undefined && !isImpedance(value)
            ? t('impedance.invalid', { min: IMPEDANCE_MIN, max: IMPEDANCE_MAX })
            : undefined);
    const emit = (ohms: string, coils2: boolean) =>
        onChange(formatImpedance(coils2 && ohms.trim() !== '' ? `${ohms}+${ohms}` : ohms));

    return (
        <TextField
            value={shown}
            onChange={(text) => {
                // Só dígitos e o separador: letras, o Ω e o "+" nunca entram.
                const clean = text.replace(/[^\d.,]/g, '');

                setDraft(clean);
                emit(clean, dual);
            }}
            onBlur={() => setDraft(undefined)}
            isInvalid={message !== undefined}
            isDisabled={disabled}
            validationBehavior="aria"
            inputMode="decimal"
            autoComplete="off"
            maxLength={6}
            className={cn('group flex max-w-56 flex-col gap-1', className)}
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
            {/* Bobina simples ou dupla logo abaixo, na largura do campo: escolha binária com alvos
                grandes, no mesmo padrão dos outros seletores dos painéis. */}
            <SegmentedControl
                label={t('impedance.coils')}
                size="sm"
                className="flex w-full"
                selected={dual ? 'dual' : 'single'}
                onChange={(id) => {
                    const next = id === 'dual';

                    setDualWhenEmpty(next);
                    emit(variant === null ? (draft ?? '') : String(variant.ohms), next);
                }}
                options={[
                    { id: 'single', label: t('impedance.single'), short: t('impedance.singleShort'), disabled },
                    { id: 'dual', label: t('impedance.dual'), short: t('impedance.dualShort'), disabled },
                ]}
            />
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
