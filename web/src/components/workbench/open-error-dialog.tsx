import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { OpenErrorCode } from '@/lib/project/file';

export type OpenError = { code: OpenErrorCode; path?: string };

type OpenErrorDialogProps = {
    error: OpenError | null;
    onClose: () => void;
};

// Arquivo recusado: só a mensagem traduzida do código, nunca o texto do validador.
export function OpenErrorDialog({ error, onClose }: OpenErrorDialogProps) {
    const { t } = useTranslation('project');

    return (
        <Dialog
            title={t('dialogs.openError.title')}
            open={error !== null}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <p className="text-sm text-muted">
                {error === null
                    ? ''
                    : t(`errors.${error.code}`, { path: error.path ?? '' })}
            </p>
            <div className="flex justify-end">
                <Button variant="primary" onPress={onClose} autoFocus>
                    {t('dialogs.openError.close')}
                </Button>
            </div>
        </Dialog>
    );
}
