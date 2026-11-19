import { AlertTriangle, Bot, Check, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextInput } from '@/components/ui/text-field';
import { deriveDriver, suggestBox } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import {
    AI_PRIORITIES,
    AI_USAGES,
    requestAiSuggestion,
} from '@/lib/box-suggestion/client';
import type {
    AiCandidate,
    AiPriority,
    AiSuggestionError,
    AiUsage,
} from '@/lib/box-suggestion/client';
import { checkCandidate } from '@/lib/box-suggestion/evaluate';
import type { CandidateCheck } from '@/lib/box-suggestion/evaluate';
import { getTurnstileToken } from '@/lib/submission/turnstile';
import { toSi } from '@/lib/units/convert';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Chamado depois de aplicar um candidato, com o texto para o aviso do grupo.
    onApplied: (message: string) => void;
};

type Phase =
    | { step: 'form' }
    | { step: 'loading' }
    | { step: 'error'; error: AiSuggestionError; retryAfterS?: number }
    | {
          step: 'results';
          items: { candidate: AiCandidate; check: CandidateCheck }[];
      };

// Sugestão de caixa por IA: a pessoa escolhe o uso, a prioridade e (opcional) o volume máximo; a IA
// propõe até três caixas e cada uma é simulada pelo motor do app antes de aparecer. As inviáveis
// ficam visíveis, mas sem o botão de aplicar. Aplicar é uma etapa só de desfazer.
export function AiSuggestDialog({ open, onOpenChange, onApplied }: Props) {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const data = useActiveProject((state) => state.data);
    const apply = useActiveProject((state) => state.apply);
    const [usage, setUsage] = useState<AiUsage>('car');
    const [priority, setPriority] = useState<AiPriority>('deep');
    const [maxVolume, setMaxVolume] = useState('');
    const [phase, setPhase] = useState<Phase>({ step: 'form' });
    const controller = useRef<AbortController | null>(null);
    const volumeUnit = defaultUnitFor('volume', unitSystem);
    const volume = (si: number) => formatWithUnit(si, volumeUnit, locale);
    const lengthUnit = defaultUnitFor('length', unitSystem);
    const typed = Number(maxVolume.replace(',', '.'));
    const maxInvalid =
        maxVolume.trim() !== '' && !(Number.isFinite(typed) && typed > 0);

    const close = (next: boolean) => {
        if (!next) {
            controller.current?.abort();
            setPhase({ step: 'form' });
        }

        onOpenChange(next);
    };

    const ask = async () => {
        const { values } = deriveDriver(data.driver);
        const get = (key: keyof typeof values) => values[key].value;
        const fs = get('fs_hz');
        const qts = get('qts');
        const vas = get('vas_m3');

        if (fs === undefined || qts === undefined || vas === undefined) {
            return;
        }

        setPhase({ step: 'loading' });
        controller.current?.abort();
        const abort = new AbortController();
        controller.current = abort;

        const token = await getTurnstileToken();

        if (!token.ok) {
            setPhase({ step: 'error', error: 'verification' });

            return;
        }

        // A sugestão clássica vai como referência para a IA (tipo atual, se for selada ou dutada).
        const reference = suggestBox({
            ...data,
            box: {
                ...data.box,
                type: data.box.type === 'closed' ? 'closed' : 'vented',
            },
        });
        const optional = (key: keyof typeof values) => {
            const value = get(key);

            return value === undefined ? {} : { [key]: value };
        };

        const result = await requestAiSuggestion(
            {
                locale: locale.startsWith('pt') ? 'pt-BR' : 'en',
                driver: {
                    fs_hz: fs,
                    qts,
                    vas_m3: vas,
                    ...optional('qes'),
                    ...optional('re_ohm'),
                    ...optional('xmax_m'),
                    ...optional('sd_m2'),
                    ...optional('pe_w'),
                    ...optional('vd_m3'),
                },
                drivers_count: Math.max(1, Math.round(data.drivers.count)),
                usage,
                priority,
                ...(maxVolume.trim() === '' || maxInvalid
                    ? {}
                    : { max_volume_m3: toSi(typed, volumeUnit) }),
                ...(reference.ok
                    ? {
                          classic: {
                              type:
                                  reference.fb_hz === undefined
                                      ? 'closed'
                                      : 'vented',
                              vb_m3: reference.vb_m3,
                              ...(reference.fb_hz === undefined
                                  ? {}
                                  : { fb_hz: reference.fb_hz }),
                              alignment: reference.alignment,
                          },
                      }
                    : {}),
                website: '',
                ...(token.token === undefined
                    ? {}
                    : { turnstile_token: token.token }),
            },
            abort.signal,
        );

        if (!result.ok) {
            if (result.aborted !== true) {
                setPhase({
                    step: 'error',
                    error: result.error,
                    retryAfterS: result.retryAfterS,
                });
            }

            return;
        }

        setPhase({
            step: 'results',
            items: result.candidates.map((candidate) => ({
                candidate,
                check: checkCandidate(data, candidate),
            })),
        });
    };

    const choose = (candidate: AiCandidate, check: CandidateCheck) => {
        apply(() => check.data);
        onApplied(
            t('ai.applied', {
                title: candidate.title,
                vb: volume(candidate.vb_m3),
            }),
        );
        close(false);
    };

    return (
        <Dialog
            title={t('ai.title')}
            open={open}
            onOpenChange={close}
            size="lg"
        >
            <div className="flex flex-col gap-4">
                <p className="text-xs text-muted">{t('ai.intro')}</p>

                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted">
                        {t('ai.usage')}
                    </span>
                    <SegmentedControl<AiUsage>
                        label={t('ai.usage')}
                        variant="tiles"
                        className="grid w-full grid-cols-3"
                        selected={usage}
                        onChange={setUsage}
                        options={AI_USAGES.map((id) => ({
                            id,
                            label: t(`ai.usages.${id}`),
                        }))}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-muted">
                        {t('ai.priority')}
                    </span>
                    <SegmentedControl<AiPriority>
                        label={t('ai.priority')}
                        variant="tiles"
                        className="grid w-full grid-cols-3"
                        selected={priority}
                        onChange={setPriority}
                        options={AI_PRIORITIES.map((id) => ({
                            id,
                            label: t(`ai.priorities.${id}`),
                        }))}
                    />
                </div>

                <TextInput
                    label={t('ai.maxVolume', {
                        unit: findUnit(volumeUnit).symbol,
                    })}
                    hint={t('ai.maxVolumeHint')}
                    value={maxVolume}
                    onChange={(text) =>
                        setMaxVolume(text.replace(/[^\d.,]/g, ''))
                    }
                    placeholder={t('ai.maxVolumePlaceholder')}
                    error={maxInvalid ? t('ai.maxVolumeInvalid') : undefined}
                    maxLength={8}
                />

                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-muted">{t('ai.limits')}</p>
                    <Button
                        variant="primary"
                        onPress={() => void ask()}
                        disabled={phase.step === 'loading' || maxInvalid}
                    >
                        {phase.step === 'loading' ? (
                            <LoaderCircle
                                aria-hidden="true"
                                className="size-4 motion-safe:animate-spin"
                            />
                        ) : (
                            <Bot aria-hidden="true" className="size-4" />
                        )}
                        {phase.step === 'loading'
                            ? t('ai.asking')
                            : t('ai.ask')}
                    </Button>
                </div>

                <div aria-live="polite" className="flex flex-col gap-3">
                    {phase.step === 'error' && (
                        <Banner tone="warn" icon={AlertTriangle}>
                            {t(`ai.errors.${phase.error}`, {
                                minutes: Math.max(
                                    1,
                                    Math.ceil((phase.retryAfterS ?? 60) / 60),
                                ),
                            })}
                        </Banner>
                    )}

                    {phase.step === 'results' &&
                        phase.items.map(({ candidate, check }, index) => (
                            <article
                                key={index}
                                className="flex flex-col gap-2 rounded-lg border border-border p-3"
                            >
                                <header className="flex items-start justify-between gap-3">
                                    <div>
                                        <h4 className="text-sm font-semibold">
                                            {candidate.title}
                                        </h4>
                                        <p className="text-xs text-muted">
                                            {[
                                                t(`boxType.${candidate.type}`),
                                                `Vb ${volume(candidate.vb_m3)}`,
                                                candidate.fb_hz === null
                                                    ? undefined
                                                    : `Fb ${formatWithUnit(candidate.fb_hz, 'Hz', locale)}`,
                                                portText(
                                                    candidate,
                                                    t,
                                                    locale,
                                                    lengthUnit,
                                                ),
                                            ]
                                                .filter(
                                                    (part) =>
                                                        part !== undefined,
                                                )
                                                .join(' · ')}
                                        </p>
                                    </div>
                                    <Button
                                        variant="quiet"
                                        onPress={() => choose(candidate, check)}
                                        disabled={!check.usable}
                                    >
                                        <Check
                                            aria-hidden="true"
                                            className="size-4"
                                        />
                                        {t('ai.apply')}
                                    </Button>
                                </header>
                                {candidate.rationale !== '' && (
                                    <p className="text-xs">
                                        {candidate.rationale}
                                    </p>
                                )}
                                <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 rounded-md bg-raised/60 px-2.5 py-1.5 text-xs sm:grid-cols-4">
                                    <Metric
                                        label="F3"
                                        value={
                                            check.f3_hz === undefined
                                                ? '—'
                                                : formatWithUnit(
                                                      check.f3_hz,
                                                      'Hz',
                                                      locale,
                                                  )
                                        }
                                    />
                                    <Metric
                                        label={t('volume.net')}
                                        value={
                                            check.net_m3 === undefined ||
                                            check.net_m3 <= 0
                                                ? '—'
                                                : volume(check.net_m3)
                                        }
                                    />
                                    {candidate.type === 'vented' && (
                                        <>
                                            <Metric
                                                label={t('results.portLength')}
                                                value={
                                                    check.port_length_m ===
                                                        undefined ||
                                                    !(check.port_length_m > 0)
                                                        ? '—'
                                                        : formatWithUnit(
                                                              check.port_length_m,
                                                              lengthUnit,
                                                              locale,
                                                          )
                                                }
                                            />
                                            <Metric
                                                label={t(
                                                    'results.portVelocity',
                                                )}
                                                value={
                                                    check.velocity_ms ===
                                                    undefined
                                                        ? '—'
                                                        : formatWithUnit(
                                                              check.velocity_ms,
                                                              'm/s',
                                                              locale,
                                                          )
                                                }
                                            />
                                        </>
                                    )}
                                </dl>
                                {(!check.usable || check.loud) && (
                                    <p className="flex items-center gap-1.5 text-[11px] text-status-warn">
                                        <AlertTriangle
                                            aria-hidden="true"
                                            className="size-3.5"
                                        />
                                        {check.usable
                                            ? t('ai.loud')
                                            : t('ai.unusable')}
                                    </p>
                                )}
                            </article>
                        ))}

                    {phase.step === 'results' && (
                        <p className="text-[11px] text-muted">
                            {t('ai.disclaimer')}
                        </p>
                    )}
                </div>
            </div>
        </Dialog>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col">
            <dt className="text-muted">{label}</dt>
            <dd className="num font-semibold">{value}</dd>
        </div>
    );
}

function portText(
    candidate: AiCandidate,
    t: (key: string, options?: Record<string, unknown>) => string,
    locale: string,
    unit: ReturnType<typeof defaultUnitFor>,
): string | undefined {
    const { port } = candidate;

    if (port === null) {
        return undefined;
    }

    const size =
        port.shape === 'round'
            ? `Ø ${formatWithUnit(port.diameter_m, unit, locale)}`
            : `${formatWithUnit(port.width_m, unit, locale)} × ${formatWithUnit(port.height_m, unit, locale)}`;

    return t('ai.port', { count: port.count, size });
}
