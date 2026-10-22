import { FileText, X } from 'lucide-react';
import { useState } from 'react';
import { FileTrigger } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { ManualState } from '@/hooks/use-submit-driver';
import { MANUAL_MAX_BYTES } from '@/lib/submission/manual-client';
import type { ManualError } from '@/lib/submission/manual-client';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import type { NumericKey } from '@/lib/submission/schema';

type ManualFillProps = {
    manual: ManualState;
    offline: boolean;
    // O envio do driver em andamento trava o resto do formulário.
    sending: boolean;
    onFill: (file: File) => void;
};

type T = (key: string, options?: Record<string, unknown>) => string;

function looksLikePdf(file: File): boolean {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

function sizeLabel(bytes: number): string {
    return bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(bytes / 1024))} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fieldName(key: NumericKey, t: T): string {
    return key === 'nominal_diameter_m'
        ? t('fields.diameter')
        : PARAMETERS[key as ParameterKey].symbol;
}

function failureMessage(
    failure: { error: ManualError; retryAfterS?: number },
    t: T,
): string {
    if (failure.error === 'rateLimited') {
        return failure.retryAfterS === undefined
            ? t('manual.failure.rateLimitedUnknown')
            : t('manual.failure.rateLimited', {
                  minutes: Math.max(1, Math.ceil(failure.retryAfterS / 60)),
              });
    }

    return t(`manual.failure.${failure.error}`);
}

// Leitura de manual (specs/009, contracts/ui.md): anexa o PDF e pede ao servidor a sugestão, que o
// hook aplica só nos campos vazios. Falhas e limites nunca bloqueiam o resto do formulário.
export function ManualFill({
    manual,
    offline,
    sending,
    onFill,
}: ManualFillProps) {
    const { t } = useTranslation('submission');
    const [file, setFile] = useState<File | undefined>();
    const [fileError, setFileError] = useState<ManualError | undefined>();
    const reading = manual.status === 'reading';
    const locked = offline || sending || manual.unavailable;

    function select(files: FileList | null): void {
        const chosen = files?.item(0);

        if (chosen === null || chosen === undefined) {
            return;
        }

        if (!looksLikePdf(chosen)) {
            setFile(undefined);
            setFileError('notPdf');
            return;
        }

        if (chosen.size > MANUAL_MAX_BYTES) {
            setFile(undefined);
            setFileError('tooLarge');
            return;
        }

        setFileError(undefined);
        setFile(chosen);
    }

    const warnings =
        manual.status === 'done'
            ? [
                  ...manual.warnings.map((warning) =>
                      t(`manual.warnings.${warning}`),
                  ),
                  ...(manual.discarded.length > 0
                      ? [
                            t('manual.warnings.discarded', {
                                fields: manual.discarded
                                    .map((key) => fieldName(key, t))
                                    .join(', '),
                            }),
                        ]
                      : []),
              ]
            : [];

    return (
        <section
            aria-labelledby="manual-fill-title"
            className="flex flex-col gap-2 rounded-md border border-border p-3"
        >
            <h3
                id="manual-fill-title"
                className="text-xs font-semibold text-muted"
            >
                {t('manual.title')}
            </h3>

            <div className="flex flex-wrap items-center gap-2">
                <FileTrigger
                    acceptedFileTypes={['application/pdf']}
                    onSelect={select}
                >
                    <Button variant="secondary" disabled={locked || reading}>
                        {t('manual.choose')}
                    </Button>
                </FileTrigger>
                {file !== undefined && (
                    <>
                        <span className="inline-flex items-center gap-1 text-sm">
                            <FileText aria-hidden="true" size={14} />
                            <span>{file.name}</span>
                            <span className="num text-muted">
                                ({sizeLabel(file.size)})
                            </span>
                        </span>
                        <Button
                            variant="quiet"
                            disabled={reading}
                            aria-label={`${t('manual.remove')}: ${file.name}`}
                            onPress={() => setFile(undefined)}
                        >
                            <X aria-hidden="true" size={14} />
                            {t('manual.remove')}
                        </Button>
                    </>
                )}
            </div>

            <div>
                <Button
                    variant="primary"
                    disabled={file === undefined || locked || reading}
                    aria-busy={reading}
                    onPress={() => {
                        if (file !== undefined) {
                            onFill(file);
                        }
                    }}
                >
                    {reading ? t('manual.reading') : t('manual.fill')}
                </Button>
            </div>

            <p className="text-xs text-muted">{t('manual.privacy')}</p>

            <div
                aria-live="polite"
                className="flex flex-col gap-1 text-sm empty:hidden"
            >
                {offline && <p className="text-muted">{t('manual.offline')}</p>}
                {fileError !== undefined && (
                    <p role="alert" className="text-status-error">
                        {t(`manual.failure.${fileError}`)}
                    </p>
                )}
                {manual.status === 'failed' && manual.failure !== undefined && (
                    <p role="alert" className="text-status-error">
                        {failureMessage(manual.failure, t)}
                    </p>
                )}
                {manual.status === 'done' && (
                    <>
                        <p>
                            {manual.filled > 0
                                ? t('manual.filled', { count: manual.filled })
                                : t('manual.filledNone')}
                        </p>
                        <ul className="list-disc pl-5 text-status-warn">
                            {warnings.map((warning) => (
                                <li key={warning}>{warning}</li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        </section>
    );
}
