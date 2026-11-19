import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog } from '@/components/ui/dialog';
import { useSubmitDriver } from '@/hooks/use-submit-driver';
import { emptyForm } from '@/lib/submission/from-project';
import { SubmitChoice } from './submit-choice';
import type { SubmitPath } from './submit-choice';
import { SubmitConfirmation } from './submit-confirmation';
import { SubmitDriverForm } from './submit-driver-form';

type SubmitDriverDialogProps = {
    onClose: () => void;
};

// Envio de driver ao catálogo. Primeiro a pessoa escolhe entre anexar o manual ou preencher à mão;
// o formulário sempre começa vazio (nunca copia o driver do projeto).
export default function SubmitDriverDialog({
    onClose,
}: SubmitDriverDialogProps) {
    const { t } = useTranslation('submission');
    const [initial] = useState(emptyForm);
    const [path, setPath] = useState<SubmitPath | undefined>();
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
                    emailNotice
                    onClose={onClose}
                />
            ) : path === undefined ? (
                <SubmitChoice onChoose={setPath} onCancel={onClose} />
            ) : (
                <>
                    <SubmitDriverForm
                        key={path}
                        withManual={path === 'manual'}
                        onBack={() => setPath(undefined)}
                        onSkipManual={() => setPath('fields')}
                        form={submission.form}
                        onChange={submission.setForm}
                        trap={submission.trap}
                        onTrapChange={submission.setTrap}
                        errors={submission.errors}
                        failure={submission.failure}
                        manual={submission.manual}
                        auto={submission.auto}
                        onFillManual={(file) =>
                            void submission.fillFromManual(file)
                        }
                        sending={submission.status === 'sending'}
                        offline={submission.offline}
                        onSubmit={() => void submission.submit()}
                        onCancel={requestClose}
                        onRetry={() => void submission.submit()}
                    />
                </>
            )}
            <ConfirmDialog
                open={confirmingDiscard}
                title={t('discard.title')}
                tone="danger"
                onCancel={() => setConfirmingDiscard(false)}
                actions={
                    <>
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
                    </>
                }
            >
                {t('discard.body')}
            </ConfirmDialog>
        </Dialog>
    );
}
