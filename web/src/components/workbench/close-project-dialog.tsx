import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

type CloseProjectDialogProps = {
    // Nome exibido do projeto a fechar; null = diálogo fechado.
    name: string | null;
    onExportAndClose: () => void;
    onDiscard: () => void;
    onCancel: () => void;
};

// Fechar um projeto com alterações não exportadas (FR-021c).
export function CloseProjectDialog({
    name,
    onExportAndClose,
    onDiscard,
    onCancel,
}: CloseProjectDialogProps) {
    const { t } = useTranslation('project');

    return (
        <Dialog
            title={t('dialogs.close.title')}
            open={name !== null}
            onOpenChange={(open) => {
                if (!open) {
                    onCancel();
                }
            }}
        >
            <p className="text-sm text-muted">
                {t('dialogs.close.body', { name: name ?? '' })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
                <Button variant="quiet" onPress={onCancel}>
                    {t('dialogs.close.cancel')}
                </Button>
                <Button onPress={onDiscard}>
                    {t('dialogs.close.discard')}
                </Button>
                <Button variant="primary" onPress={onExportAndClose} autoFocus>
                    {t('dialogs.close.export')}
                </Button>
            </div>
        </Dialog>
    );
}
