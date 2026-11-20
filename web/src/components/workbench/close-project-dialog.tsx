import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type CloseProjectDialogProps = {
    // Nome exibido do projeto a fechar; null = diálogo fechado.
    name: string | null;
    onExportAndClose: () => void;
    onDiscard: () => void;
    onCancel: () => void;
};

// Fechar um projeto com alterações não salvas.
export function CloseProjectDialog({
    name,
    onExportAndClose,
    onDiscard,
    onCancel,
}: CloseProjectDialogProps) {
    const { t } = useTranslation('project');
    // O projeto some assim que é fechado, mas o diálogo ainda anima a saída: o texto guarda o
    // último nome em vez de piscar com um nome vazio.
    const lastName = useRef('');

    if (name !== null) {
        lastName.current = name;
    }

    return (
        <ConfirmDialog
            title={t('dialogs.close.title')}
            open={name !== null}
            onCancel={onCancel}
            wide
            actions={
                <>
                    <Button
                        variant="quiet"
                        onPress={onCancel}
                        className="sm:mr-auto"
                    >
                        {t('dialogs.close.cancel')}
                    </Button>
                    <Button onPress={onDiscard} className="text-status-error">
                        {t('dialogs.close.discard')}
                    </Button>
                    <Button
                        variant="primary"
                        onPress={onExportAndClose}
                        autoFocus
                    >
                        {t('dialogs.close.export')}
                    </Button>
                </>
            }
        >
            {t('dialogs.close.body', { name: lastName.current })}
        </ConfirmDialog>
    );
}
