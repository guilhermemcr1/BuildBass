import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

type SubmitConfirmationProps = {
    protocol: string;
    emailNotice: boolean;
    onClose: () => void;
};

// Recibo do envio (FR-006): protocolo, explicação da revisão e garantia de que o projeto não mudou.
export function SubmitConfirmation({
    protocol,
    emailNotice,
    onClose,
}: SubmitConfirmationProps) {
    const { t } = useTranslation('submission');
    const [copied, setCopied] = useState(false);

    async function copy(): Promise<void> {
        try {
            await navigator.clipboard.writeText(protocol);
            setCopied(true);
        } catch {
            // Sem permissão de área de transferência: o código continua visível e selecionável.
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm">{t('success.review')}</p>
            <div className="flex flex-col gap-1 rounded-md border border-border bg-raised p-3">
                <span className="text-xs font-semibold text-muted">
                    {t('success.protocol')}
                </span>
                <code className="num text-sm break-all select-all">
                    {protocol}
                </code>
                <div className="flex items-center gap-2 pt-1">
                    <Button variant="secondary" onPress={() => void copy()}>
                        {copied ? (
                            <Check aria-hidden="true" className="size-4" />
                        ) : (
                            <Copy aria-hidden="true" className="size-4" />
                        )}
                        {t('actions.copy')}
                    </Button>
                    <span role="status" className="text-xs text-muted">
                        {copied ? t('actions.copied') : ''}
                    </span>
                </div>
            </div>
            {emailNotice && (
                <p className="text-sm">{t('success.emailNotice')}</p>
            )}
            <p className="text-sm text-muted">
                {t('success.projectUnchanged')}
            </p>
            <div className="flex justify-end">
                <Button variant="primary" onPress={onClose} autoFocus>
                    {t('actions.close')}
                </Button>
            </div>
        </div>
    );
}
