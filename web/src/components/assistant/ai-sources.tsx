import {
    CheckCircle2,
    FileText,
    FileUp,
    Loader2,
    RotateCcw,
    Sparkles,
    WifiOff,
    X,
} from 'lucide-react';
import { useId, useState } from 'react';
import { DropZone, FileTrigger, Text } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import type { DriverAiFill } from '@/hooks/use-driver-ai-fill';
import { filterParameterText } from '@/lib/assistant/text-filter';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import {
    MANUAL_MAX_BYTES,
    MANUAL_TEXT_MAX_CHARS,
    MANUAL_TEXT_MIN_CHARS,
} from '@/lib/submission/manual-client';
import type { NumericKey } from '@/lib/submission/schema';
import { cn } from '@/lib/utils';

type T = (key: string, options?: Record<string, unknown>) => string;

function symbolOf(key: NumericKey, t: T): string {
    return key === 'nominal_diameter_m'
        ? t('driver.ai.diameter')
        : PARAMETERS[key as ParameterKey].symbol;
}

// Resultado da leitura (comum ao PDF e ao texto): quantos campos entraram, o que conferir e por
// que falhou. A mensagem de falha é a mesma do formulário de envio.
export function AiOutcome({ fill }: { fill: DriverAiFill }) {
    const { t } = useTranslation('assistant');
    const { t: tSubmission } = useTranslation('submission');
    const { state } = fill;

    if (state.status === 'failed') {
        const { error, retryAfterS } = state.failure;
        const message =
            error === 'rateLimited'
                ? retryAfterS === undefined
                    ? tSubmission('manual.failure.rateLimitedUnknown')
                    : tSubmission('manual.failure.rateLimited', {
                          minutes: Math.max(1, Math.ceil(retryAfterS / 60)),
                      })
                : tSubmission(`manual.failure.${error}`);

        return (
            <div role="alert">
                <Banner tone="warn">{message}</Banner>
            </div>
        );
    }

    if (state.status !== 'done') {
        return null;
    }

    return (
        <div role="status" className="flex flex-col gap-1.5">
            <p className="flex items-center gap-2 text-sm">
                <CheckCircle2
                    aria-hidden="true"
                    className="size-4 text-status-ok"
                />
                {state.filled.length === 0
                    ? t('driver.ai.filledNone')
                    : t('driver.ai.filled', { count: state.filled.length })}
            </p>
            {state.suspect.length > 0 && (
                <Banner tone="warn">
                    {t('driver.ai.suspect', {
                        fields: state.suspect
                            .map((key) => symbolOf(key, t))
                            .join(', '),
                    })}
                </Banner>
            )}
            {state.discarded.length > 0 && (
                <Banner tone="warn">
                    {t('driver.ai.discarded', {
                        fields: state.discarded
                            .map((key) => symbolOf(key, t))
                            .join(', '),
                    })}
                </Banner>
            )}
            {state.warnings.includes('multiple_drivers') && (
                <Banner>{t('driver.ai.multiple')}</Banner>
            )}
            <p className="text-xs text-muted">{t('driver.ai.review')}</p>
        </div>
    );
}

function Unavailable({ fill }: { fill: DriverAiFill }) {
    const { t } = useTranslation('assistant');

    if (fill.offline) {
        return (
            <Banner tone="warn" icon={WifiOff}>
                {t('driver.ai.offline')}
            </Banner>
        );
    }

    return fill.unavailable ? (
        <Banner tone="warn">{t('driver.ai.unavailable')}</Banner>
    ) : null;
}

function looksLikePdf(file: File): boolean {
    return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

// Manual em PDF: arrastar ou escolher. Arquivo válido já começa a ser lido; o cartão do arquivo
// mostra o andamento e deixa remover (cancelando a leitura, se ainda estiver lendo) ou tentar de novo.
export function PdfSource({ fill }: { fill: DriverAiFill }) {
    const { t } = useTranslation('assistant');
    const [file, setFile] = useState<File>();
    const [fileError, setFileError] = useState<string>();
    const reading = fill.state.status === 'reading';
    const failed = fill.state.status === 'failed';
    const locked = fill.offline || fill.unavailable;

    const accept = (chosen: File | null | undefined) => {
        if (chosen == null) {
            return;
        }

        if (!looksLikePdf(chosen)) {
            setFileError(t('driver.pdf.notPdf'));
        } else if (chosen.size > MANUAL_MAX_BYTES) {
            setFileError(t('driver.pdf.tooLarge'));
        } else {
            setFileError(undefined);
            setFile(chosen);
            void fill.fromPdf(chosen);
        }
    };

    const remove = () => {
        fill.reset();
        setFile(undefined);
    };

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{t('driver.pdf.intro')}</p>
            <Unavailable fill={fill} />
            {file === undefined ? (
                <DropZone
                    isDisabled={locked}
                    onDrop={async (event) => {
                        const item = event.items.find(
                            (entry) => entry.kind === 'file',
                        );

                        if (item !== undefined && item.kind === 'file') {
                            accept(await item.getFile());
                        }
                    }}
                    className={cn(
                        'flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-background/40 px-4 py-8 text-center outline-none motion-safe:transition-[border-color,background-color] motion-safe:duration-200',
                        'data-[drop-target]:border-accent data-[drop-target]:bg-accent/10 data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent',
                    )}
                >
                    <span
                        aria-hidden="true"
                        className="grid size-11 place-items-center rounded-full bg-accent/12 text-accent-soft"
                    >
                        <FileUp className="size-5" />
                    </span>
                    <Text slot="label" className="text-sm font-medium">
                        {t('driver.pdf.drop')}
                    </Text>
                    <FileTrigger
                        acceptedFileTypes={['application/pdf']}
                        onSelect={(files) => accept(files?.[0])}
                    >
                        <Button disabled={locked}>
                            {t('driver.pdf.choose')}
                        </Button>
                    </FileTrigger>
                    <span className="text-xs text-muted">
                        {t('driver.pdf.hint')}
                    </span>
                </DropZone>
            ) : (
                <AttachedFile
                    file={file}
                    reading={reading}
                    failed={failed}
                    onRemove={remove}
                    onRetry={locked ? undefined : () => void fill.fromPdf(file)}
                />
            )}
            {fileError !== undefined && (
                <div role="alert">
                    <Banner tone="warn">{fileError}</Banner>
                </div>
            )}
            <AiOutcome fill={fill} />
            <p className="text-[11px] text-muted">{t('driver.pdf.privacy')}</p>
        </div>
    );
}

// Cartão do PDF anexado: nome, tamanho e andamento da leitura, com remover e tentar de novo.
function AttachedFile({
    file,
    reading,
    failed,
    onRemove,
    onRetry,
}: {
    file: File;
    reading: boolean;
    failed: boolean;
    onRemove: () => void;
    onRetry?: () => void;
}) {
    const { t, i18n } = useTranslation('assistant');
    const size = new Intl.NumberFormat(i18n.language, {
        style: 'unit',
        unit: 'megabyte',
        maximumFractionDigits: 1,
    }).format(Math.max(file.size / 1_000_000, 0.1));

    return (
        <div
            className={cn(
                'relative flex swap items-center gap-3 overflow-hidden rounded-lg border bg-surface px-3 py-3',
                failed ? 'border-status-warn/60' : 'border-border',
            )}
        >
            <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-md bg-accent/12 text-accent-soft"
            >
                <FileText className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                    {file.name}
                </span>
                <span
                    aria-live="polite"
                    className="flex items-center gap-1.5 text-xs text-muted"
                >
                    {reading && (
                        <Loader2
                            aria-hidden="true"
                            className="size-3.5 animate-spin text-accent-soft"
                        />
                    )}
                    {size} ·{' '}
                    {reading
                        ? t('driver.pdf.reading')
                        : failed
                          ? t('driver.pdf.failed')
                          : t('driver.pdf.attached')}
                </span>
            </span>
            {failed && onRetry !== undefined && (
                <Button onPress={onRetry} className="shrink-0">
                    <RotateCcw aria-hidden="true" className="size-4" />
                    {t('driver.pdf.retry')}
                </Button>
            )}
            <Button
                variant="quiet"
                onPress={onRemove}
                aria-label={`${t(reading ? 'driver.pdf.cancel' : 'driver.pdf.remove')}: ${file.name}`}
                className="size-8 shrink-0 px-0"
            >
                <X aria-hidden="true" className="size-4" />
            </Button>
            {/* Barra indeterminada na base do cartão enquanto a IA lê. */}
            {reading && (
                <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-accent/15"
                >
                    <span className="block h-full reading-bar w-1/3 bg-accent" />
                </span>
            )}
        </div>
    );
}

// Texto colado (da loja, do PDF, de uma mensagem): só as linhas com parâmetro seguem para a IA.
// O contador e a prévia do filtro mostram, antes de enviar, o que vai e o que fica.
export function TextSource({ fill }: { fill: DriverAiFill }) {
    const { t } = useTranslation('assistant');
    const id = useId();
    const [text, setText] = useState('');
    const reading = fill.state.status === 'reading';
    const locked = fill.offline || fill.unavailable || reading;
    const trimmed = text.trim();
    const filtered = filterParameterText(trimmed);
    const tooShort = trimmed.length < MANUAL_TEXT_MIN_CHARS;
    const canSend = !locked && !tooShort && filtered.relevant > 0;

    return (
        <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{t('driver.text.intro')}</p>
            <Unavailable fill={fill} />
            <div className="flex flex-col gap-1.5">
                <label htmlFor={id} className="text-sm font-medium">
                    {t('driver.text.label')}
                </label>
                <textarea
                    id={id}
                    value={text}
                    maxLength={MANUAL_TEXT_MAX_CHARS}
                    disabled={locked}
                    onChange={(event) =>
                        setText(
                            event.currentTarget.value.slice(
                                0,
                                MANUAL_TEXT_MAX_CHARS,
                            ),
                        )
                    }
                    placeholder={t('driver.text.placeholder')}
                    aria-describedby={`${id}-count ${id}-filter`}
                    rows={8}
                    spellCheck={false}
                    className="min-h-40 w-full resize-y rounded-md border border-border bg-raised px-2.5 py-2 font-mono text-[13px] text-foreground outline-none placeholder:text-muted focus:border-accent focus:bg-surface disabled:cursor-not-allowed"
                />
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted">
                    <span id={`${id}-filter`}>
                        {trimmed === ''
                            ? t('driver.text.filterEmpty')
                            : filtered.relevant === 0
                              ? t('driver.text.filterNone')
                              : t('driver.text.filter', {
                                    count: filtered.relevant,
                                    dropped: filtered.dropped,
                                })}
                    </span>
                    <span id={`${id}-count`} className="tabular-nums">
                        {t('driver.text.count', {
                            used: text.length,
                            max: MANUAL_TEXT_MAX_CHARS,
                        })}
                    </span>
                </div>
            </div>
            <Button
                variant="primary"
                disabled={!canSend}
                onPress={() => void fill.fromText(trimmed)}
                className="self-start"
            >
                {reading ? (
                    <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                    />
                ) : (
                    <Sparkles aria-hidden="true" className="size-4" />
                )}
                {reading ? t('driver.ai.reading') : t('driver.text.read')}
            </Button>
            <AiOutcome fill={fill} />
            <p className="text-[11px] text-muted">{t('driver.text.privacy')}</p>
        </div>
    );
}
