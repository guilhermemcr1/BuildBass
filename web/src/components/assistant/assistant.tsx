import { ArrowLeft, ArrowRight, Check, CircleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    Dialog as AriaDialog,
    Modal,
    ModalOverlay,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useActiveProject } from '@/hooks/use-active-project';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { cn } from '@/lib/utils';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { boxMissing, boxReady, driverMissing, driverReady } from './readiness';
import { StepBox } from './step-box';
import { StepDriver } from './step-driver';
import type { DriverPhase } from './step-driver';
import { StepReview } from './step-review';

export type AssistantStep = 'driver' | 'box' | 'review';

const STEPS: AssistantStep[] = ['driver', 'box', 'review'];

type AssistantProps = {
    // Fecha o modal (X, Esc, clique fora ou "Concluir"); o projeto é o mesmo da bancada, nada se perde.
    onClose: () => void;
};

// Assistente passo a passo: alto-falante → caixa → conferência. Edita o projeto ativo, o mesmo da
// bancada, então dá para sair e voltar a qualquer momento. Só avança com o mínimo de cada passo:
// Fs, Qts e Vas no alto-falante e, na caixa, o que o motor precisa para a resposta.
export default function Assistant({ onClose }: AssistantProps) {
    const { t } = useTranslation('assistant');
    const offline = useOnlineStatus() === 'offline';
    const data = useActiveProject((state) => state.data);
    const [step, setStep] = useState<AssistantStep>(() =>
        driverReady(data) ? 'box' : 'driver',
    );
    // Com dados já no projeto, o passo abre direto na conferência deles; sem nada, na escolha.
    const [driverPhase, setDriverPhase] = useState<DriverPhase>(() =>
        Object.keys(data.driver).length > 0 ? 'data' : 'find',
    );
    // Sentido da última troca de passo: decide de que lado o conteúdo novo entra.
    const [direction, setDirection] = useState<'forward' | 'back'>('forward');
    const heading = useRef<HTMLHeadingElement>(null);
    const content = useRef<HTMLDivElement>(null);
    // Quantas vezes a pessoa tentou avançar sem o mínimo: mostra o que falta (e reanima o aviso).
    const [attempt, setAttempt] = useState(0);
    const index = STEPS.indexOf(step);
    const ready = {
        driver: driverPhase === 'data' && driverReady(data),
        box: boxReady(data),
        review: true,
    };
    // Um passo só abre quando os anteriores estão completos.
    const reachable = (target: AssistantStep) =>
        STEPS.slice(0, STEPS.indexOf(target)).every(
            (previous) => ready[previous],
        );

    // Ao trocar de passo, o foco vai ao título dele (leitor de tela anuncia onde está).
    const first = useRef(true);

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }

        heading.current?.focus();
    }, [step]);

    const go = (target: AssistantStep) => {
        setDirection(STEPS.indexOf(target) < index ? 'back' : 'forward');
        setAttempt(0);
        setStep(target);
    };

    // Campos que faltam no passo atual (só com os dados à vista: na escolha não há campo ainda).
    const missing: ParameterKey[] =
        step === 'driver'
            ? driverPhase === 'data'
                ? driverMissing(data)
                : []
            : step === 'box'
              ? (boxMissing(data).filter(
                    (key) => key in PARAMETERS,
                ) as ParameterKey[])
              : [];

    // Leva ao campo: rola até ele e põe o cursor, para a pessoa já digitar.
    const focusField = (key: ParameterKey) => {
        const input = content.current?.querySelector<HTMLInputElement>(
            `[data-parameter="${key}"] input`,
        );

        input?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        input?.focus({ preventScroll: true });
    };

    // Avançar sem o mínimo não fica mudo: diz o que falta e leva ao primeiro campo.
    const advance = () => {
        const target = STEPS[index + 1];

        if (target === undefined) {
            return;
        }

        if (ready[step]) {
            go(target);
            return;
        }

        setAttempt((count) => count + 1);

        if (missing[0] !== undefined) {
            focusField(missing[0]);
        }
    };

    const next = STEPS[index + 1];
    const previous = STEPS[index - 1];

    return (
        <ModalOverlay
            isOpen
            isDismissable
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
            className="fixed inset-0 z-50 flex overlay-motion items-center justify-center bg-black/50 p-4 max-sm:p-0"
        >
            <Modal className="flex h-[min(56rem,calc(100dvh-2rem))] w-full max-w-6xl modal-motion flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-xl max-sm:h-dvh max-sm:rounded-none max-sm:border-0">
                <AriaDialog
                    aria-labelledby="assistant-title"
                    className="flex min-h-0 flex-1 flex-col outline-none"
                >
                    <header className="border-b border-border bg-surface px-4 pt-4 pb-3 sm:px-6">
                        <div className="mx-auto flex max-w-6xl flex-col gap-4">
                            <div className="flex items-start justify-between gap-3">
                                <h2
                                    id="assistant-title"
                                    ref={heading}
                                    tabIndex={-1}
                                    className="text-xl font-semibold tracking-[-0.01em] text-balance outline-none"
                                >
                                    <span key={step} className="block swap">
                                        {t(`steps.${step}Title`)}
                                    </span>
                                </h2>
                                <Button
                                    variant="quiet"
                                    onPress={onClose}
                                    aria-label={t('exit')}
                                    className="-mt-1 -mr-2 size-8 shrink-0 px-0"
                                >
                                    <X aria-hidden="true" className="size-4" />
                                </Button>
                            </div>
                            <nav
                                aria-label={t('progress')}
                                className="flex flex-col gap-2"
                            >
                                <ol className="grid grid-cols-3">
                                    {STEPS.map((item, position) => {
                                        const current = item === step;
                                        const done = position < index;

                                        return (
                                            <li key={item} className="min-w-0">
                                                <button
                                                    type="button"
                                                    aria-current={
                                                        current
                                                            ? 'step'
                                                            : undefined
                                                    }
                                                    disabled={!reachable(item)}
                                                    onClick={() => go(item)}
                                                    className={cn(
                                                        'group flex max-w-full items-center gap-2 rounded-md py-1 pr-2 text-left text-xs outline-none focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed motion-safe:transition-colors',
                                                        current
                                                            ? 'text-foreground'
                                                            : done
                                                              ? 'text-muted hover:text-foreground'
                                                              : 'text-disabled',
                                                    )}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className={cn(
                                                            'grid size-5 shrink-0 place-items-center rounded-full border num text-[11px] motion-safe:transition-[background-color,border-color,color] motion-safe:duration-300',
                                                            current
                                                                ? 'border-accent bg-accent text-accent-foreground'
                                                                : done
                                                                  ? 'border-accent/60 bg-accent/15 text-accent-soft'
                                                                  : 'border-border bg-raised',
                                                        )}
                                                    >
                                                        {done ? (
                                                            <Check
                                                                strokeWidth={3}
                                                                className="size-3 check-draw"
                                                            />
                                                        ) : (
                                                            position + 1
                                                        )}
                                                    </span>
                                                    <span className="truncate font-medium">
                                                        {t(`steps.${item}`)}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ol>
                                {/* Régua única: o preenchimento corre até o fim do passo atual. */}
                                <div className="flex items-center gap-3">
                                    <div
                                        aria-hidden="true"
                                        className="relative h-1 flex-1 overflow-hidden rounded-full bg-raised"
                                    >
                                        <div
                                            className="absolute inset-0 meter-fill rounded-full bg-accent"
                                            style={{
                                                transform: `scaleX(${(index + 1) / STEPS.length})`,
                                            }}
                                        />
                                        {[1, 2].map((tick) => (
                                            <span
                                                key={tick}
                                                className="absolute inset-y-0 w-0.5 bg-surface"
                                                style={{
                                                    left: `calc(${(tick / STEPS.length) * 100}% - 1px)`,
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <span className="num text-[11px] text-muted">
                                        {t('counter', {
                                            current: index + 1,
                                            total: STEPS.length,
                                        })}
                                    </span>
                                </div>
                            </nav>
                        </div>
                    </header>
                    <div
                        ref={content}
                        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
                    >
                        <div
                            key={step}
                            className={cn(
                                'mx-auto flex max-w-6xl flex-col gap-5',
                                direction === 'back'
                                    ? 'step-back'
                                    : 'step-forward',
                            )}
                        >
                            <p className="text-sm text-muted">
                                {t(`steps.${step}Intro`)}
                            </p>
                            {attempt > 0 && !ready[step] && (
                                <div
                                    key={attempt}
                                    role="alert"
                                    className="flex nudge flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-status-warn/40 bg-warn-bg px-3 py-2.5 text-sm text-warn-foreground"
                                >
                                    <CircleAlert
                                        aria-hidden="true"
                                        className="size-4 shrink-0"
                                    />
                                    <span className="min-w-0 flex-1">
                                        {missing.length === 0
                                            ? t(
                                                  step === 'driver'
                                                      ? 'blocked.find'
                                                      : `blocked.${step}`,
                                              )
                                            : t('blocked.missing', {
                                                  count: missing.length,
                                              })}
                                    </span>
                                    {missing.length > 0 && (
                                        <span className="flex flex-wrap gap-1.5">
                                            {missing.map((key) => (
                                                <Button
                                                    key={key}
                                                    variant="secondary"
                                                    onPress={() =>
                                                        focusField(key)
                                                    }
                                                    aria-label={t(
                                                        'blocked.goTo',
                                                        {
                                                            field: PARAMETERS[
                                                                key
                                                            ].symbol,
                                                        },
                                                    )}
                                                    className="h-7 px-2.5 num text-xs"
                                                >
                                                    {PARAMETERS[key].symbol}
                                                </Button>
                                            ))}
                                        </span>
                                    )}
                                </div>
                            )}
                            {step === 'driver' && (
                                <StepDriver
                                    offline={offline}
                                    phase={driverPhase}
                                    onPhase={setDriverPhase}
                                />
                            )}
                            {step === 'box' && <StepBox />}
                            {step === 'review' && <StepReview onEdit={go} />}
                        </div>
                    </div>
                    <footer className="border-t border-border bg-surface px-4 py-3 sm:px-6">
                        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
                            {previous === undefined ? (
                                <span />
                            ) : (
                                <Button
                                    variant="quiet"
                                    onPress={() => go(previous)}
                                    className="group h-9"
                                >
                                    <ArrowLeft
                                        aria-hidden="true"
                                        className="size-4 group-data-[hovered]:-translate-x-0.5 motion-safe:transition-transform motion-safe:duration-200"
                                    />
                                    {t('back')}
                                </Button>
                            )}
                            <div className="flex flex-wrap items-center gap-3">
                                {next !== undefined && !ready[step] && (
                                    <span
                                        aria-live="polite"
                                        className="swap text-xs text-muted max-sm:hidden"
                                    >
                                        {t(
                                            step === 'driver' &&
                                                driverPhase !== 'data'
                                                ? 'blocked.find'
                                                : `blocked.${step}`,
                                        )}
                                    </span>
                                )}
                                {next === undefined ? (
                                    <Button
                                        variant="primary"
                                        onPress={onClose}
                                        className="h-9 px-4"
                                    >
                                        <Check
                                            aria-hidden="true"
                                            className="size-4"
                                        />
                                        {t('finish')}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="primary"
                                        onPress={advance}
                                        className="group h-9 px-4"
                                    >
                                        {t('next')}
                                        <ArrowRight
                                            aria-hidden="true"
                                            className="size-4 group-data-[hovered]:translate-x-0.5 motion-safe:transition-transform motion-safe:duration-200"
                                        />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </footer>
                </AriaDialog>
            </Modal>
        </ModalOverlay>
    );
}
