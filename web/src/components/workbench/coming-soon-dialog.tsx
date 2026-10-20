import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

type ComingSoonDialogProps = {
    action: string | null;
    onClose: () => void;
};

// Ações com ponto de entrada na interface mas ainda sem implementação (spec, US1 cenário 4).
export function ComingSoonDialog({ action, onClose }: ComingSoonDialogProps) {
    const { t } = useTranslation('common');

    return (
        <Dialog
            title={t('comingSoon.title')}
            open={action !== null}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <p className="text-sm text-muted">
                {t('comingSoon.body', { action: action ?? '' })}
            </p>
            <div className="flex justify-end">
                <Button variant="primary" onPress={onClose} autoFocus>
                    {t('comingSoon.close')}
                </Button>
            </div>
        </Dialog>
    );
}
