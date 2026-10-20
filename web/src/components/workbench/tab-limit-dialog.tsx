import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

type TabLimitDialogProps = {
    open: boolean;
    onClose: () => void;
};

// Novo/abrir com 3 projetos abertos (FR-021b).
export function TabLimitDialog({ open, onClose }: TabLimitDialogProps) {
    const { t } = useTranslation('project');

    return (
        <Dialog
            title={t('dialogs.limit.title')}
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    onClose();
                }
            }}
        >
            <p className="text-sm text-muted">{t('dialogs.limit.body')}</p>
            <div className="flex justify-end">
                <Button variant="primary" onPress={onClose} autoFocus>
                    {t('dialogs.limit.cancel')}
                </Button>
            </div>
        </Dialog>
    );
}
