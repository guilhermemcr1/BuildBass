import {
    CheckCircle2,
    FileText,
    FileUp,
    Loader2,
    Sparkles,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { DropZone, FileTrigger, Text } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { ManualState } from '@/hooks/use-submit-driver';
import { MANUAL_MAX_BYTES } from '@/lib/submission/manual-client';
import type { ManualError } from '@/lib/submission/manual-client';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import type { NumericKey } from '@/lib/submission/schema';
import { cn } from '@/lib/utils';

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

// Leitura de manual: anexa o PDF (arrastando ou escolhendo) e pede ao
// servidor a sugestão, que o hook aplica só nos campos vazios. Falhas e limites nunca bloqueiam o
// resto do formulário.
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

    function accept(chosen: File | null | undefined): void {
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
            className="flex flex-col gap-3 rounded-lg border border-border bg-background/40 p-4"
        >
            <header className="flex items-start gap-3">
                <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-md bg-accent/15 text-accent-soft"
                >
                    <Sparkles className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                    <h3
                        id="manual-fill-title"
                        className="flex flex-wrap items-center gap-2 text-sm font-semibold"
                    >
                        {t('manual.title')}
                        <span className="rounded-full border border-border px-2 py-px text-[11px] font-normal text-muted">
                            {t('manual.badge')}
                        </span>
                    </h3>
                    <p className="text-xs text-muted">{t('manual.subtitle')}</p>
                </div>
            </header>

            {file === undefined ? (
                <DropZone
                    isDisabled={locked || reading}
                    onDrop={(event) => {
                        const item = event.items.find(
                            (entry) => entry.kind === 'file',
                        );

                        if (item?.kind === 'file') {
                            void item.getFile().then(accept);
                        }
                    }}
                    className={({ isDropTarget, isFocusVisible }) =>
                        cn(
                            'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-5 text-center outline-none motion-safe:transition-colors',
                            isDropTarget && 'border-accent bg-accent/10',
                            isFocusVisible && 'outline-2 outline-accent',
                            (locked || reading) && 'opacity-60',
                        )
                    }
                >
                    <FileUp aria-hidden="true" className="size-6 text-muted" />
                    <Text slot="label" className="text-sm font-medium">
                        {t('manual.dropTitle')}
                    </Text>
                    <div className="flex items-center gap-2 text-xs text-muted">
                        <span>{t('manual.dropOr')}</span>
                        <FileTrigger
                            acceptedFileTypes={['application/pdf']}
                            onSelect={(files) => accept(files?.item(0))}
                        >
                            <Button
                                variant="secondary"
                                disabled={locked || reading}
                            >
                                {t('manual.choose')}
                            </Button>
                        </FileTrigger>
                    </div>
                    <p className="text-[11px] text-muted">
                        {t('manual.dropHint')}
                    </p>
                </DropZone>
            ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="grid size-10 shrink-0 place-items-center rounded-md bg-status-error/10 text-status-error"
                        >
                            <FileText className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                                {file.name}
                            </span>
                            <span className="block num text-xs text-muted">
                                {sizeLabel(file.size)}
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
                    </div>
                </div>
            )}

            <Button
                variant="primary"
                disabled={file === undefined || locked || reading}
                aria-busy={reading}
                className="h-9 w-full"
                onPress={() => {
                    if (file !== undefined) {
                        onFill(file);
                    }
                }}
            >
                {reading ? (
                    <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                    />
                ) : (
                    <Sparkles aria-hidden="true" className="size-4" />
                )}
                {reading ? t('manual.reading') : t('manual.fill')}
            </Button>

            <p className="text-[11px] text-muted">{t('manual.privacy')}</p>

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
                        <p className="flex items-center gap-1.5 text-status-ok">
                            <CheckCircle2
                                aria-hidden="true"
                                className="size-4 shrink-0"
                            />
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
