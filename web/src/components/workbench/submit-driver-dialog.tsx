import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useActiveProject } from '@/hooks/use-active-project';
import { useSubmitDriver } from '@/hooks/use-submit-driver';
import { formFromProject } from '@/lib/submission/from-project';
import { SubmitConfirmation } from './submit-confirmation';
import { SubmitDriverForm } from './submit-driver-form';

type SubmitDriverDialogProps = {
    onClose: () => void;
};

// Envio de driver ao catálogo (specs/006, contracts/ui.md). Montado só enquanto aberto, então o
// formulário sempre parte do driver do projeto ativo naquele momento (FR-002).
export default function SubmitDriverDialog({
    onClose,
}: SubmitDriverDialogProps) {
    const { t } = useTranslation('submission');
    const driver = useActiveProject((state) => state.data.driver);
    const driverSource = useActiveProject((state) => state.data.driverSource);
    // O formulário é uma cópia: editá-lo nunca altera o projeto (FR-022).
    const [initial] = useState(() => formFromProject(driver, driverSource));
    const submission = useSubmitDriver(initial);
    const [confirmingDiscard, setConfirmingDiscard] = useState(false);
    const done = submission.status === 'done';

    function requestClose(): void {
        if (!done && submission.dirty && submission.status === 'editing') {
            setConfirmingDiscard(true);
            return;
        }

        submission.abort();
        onClose();
    }

    return (
        <Dialog
            title={done ? t('success.title') : t('title')}
            open
            size="lg"
            onOpenChange={(open) => {
                if (!open) {
                    requestClose();
                }
            }}
        >
            {done && submission.protocol !== undefined ? (
                <SubmitConfirmation
                    protocol={submission.protocol}
                    emailNotice={submission.sentEmail}
                    onClose={onClose}
                />
            ) : (
                <>
                    <SubmitDriverForm
                        form={submission.form}
                        onChange={submission.setForm}
                        trap={submission.trap}
                        onTrapChange={submission.setTrap}
                        errors={submission.errors}
                        failure={submission.failure}
                        sending={submission.status === 'sending'}
                        offline={submission.offline}
                        onSubmit={() => void submission.submit()}
                        onCancel={requestClose}
                        onRetry={() => void submission.submit()}
                    />
                    {confirmingDiscard && (
                        <div
                            role="alertdialog"
                            aria-labelledby="discard-title"
                            className="flex flex-col gap-2 rounded-md border border-status-warn p-3"
                        >
                            <p
                                id="discard-title"
                                className="text-sm font-semibold"
                            >
                                {t('discard.title')}
                            </p>
                            <p className="text-sm text-muted">
                                {t('discard.body')}
                            </p>
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="secondary"
                                    autoFocus
                                    onPress={() => setConfirmingDiscard(false)}
                                >
                                    {t('discard.keep')}
                                </Button>
                                <Button
                                    variant="primary"
                                    onPress={() => {
                                        submission.abort();
                                        onClose();
                                    }}
                                >
                                    {t('discard.discard')}
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </Dialog>
    );
}
