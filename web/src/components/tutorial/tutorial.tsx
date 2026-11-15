import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { placeCard } from './placement';
import type { Rect, Size } from './placement';
import { STEPS } from './steps';

// Folga entre o elemento e o contorno do foco.
const PAD = 8;
const CARD_WIDTH = 340;
// Abaixo disso o cartão vira uma faixa na base da tela, e o foco continua no elemento.
const COMPACT_BELOW = 640;

function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Primeiro elemento do seletor que aparece na tela: a barra tem versões escondidas por tamanho.
function findTarget(selector: string | undefined): Element | null {
    if (selector === undefined) {
        return null;
    }

    for (const element of document.querySelectorAll(selector)) {
        const box = element.getBoundingClientRect();

        if (box.width > 0 && box.height > 0) {
            return element;
        }
    }

    return null;
}

function sameRect(a: Rect | null, b: Rect | null) {
    return (
        a === b ||
        (a !== null &&
            b !== null &&
            Math.abs(a.left - b.left) < 0.5 &&
            Math.abs(a.top - b.top) < 0.5 &&
            Math.abs(a.width - b.width) < 0.5 &&
            Math.abs(a.height - b.height) < 0.5)
    );
}

type TutorialProps = {
    onClose: () => void;
};

// Passeio guiado: um foco que desliza de um elemento da bancada ao próximo, escurecendo o resto, com
// um cartão ao lado explicando o passo. O que está atrás fica bloqueado enquanto o passeio dura.
export default function Tutorial({ onClose }: TutorialProps) {
    const { t } = useTranslation('tutorial');
    const titleId = useId();
    const bodyId = useId();
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [view, setView] = useState<Size>({
        width: window.innerWidth,
        height: window.innerHeight,
    });
    const [card, setCard] = useState<Size>({ width: CARD_WIDTH, height: 220 });
    const cardRef = useRef<HTMLDivElement>(null);
    const step = STEPS[index]!;
    const last = index === STEPS.length - 1;
    const compact = view.width < COMPACT_BELOW;

    const go = (to: number) =>
        setIndex(Math.min(Math.max(to, 0), STEPS.length - 1));
    const next = () => (last ? onClose() : go(index + 1));

    // Devolve o foco a quem abriu o tutorial quando ele fecha.
    useEffect(() => {
        const opener = document.activeElement;

        cardRef.current
            ?.querySelector<HTMLElement>('[data-tour-next]')
            ?.focus();

        return () => {
            if (opener instanceof HTMLElement && opener.isConnected) {
                opener.focus();
            }
        };
    }, []);

    useEffect(() => {
        const resize = () =>
            setView({ width: window.innerWidth, height: window.innerHeight });

        window.addEventListener('resize', resize);

        return () => window.removeEventListener('resize', resize);
    }, []);

    // Ao entrar no passo, leva o elemento para a tela; depois, a cada quadro, segue o retângulo dele
    // (rolagem suave, redimensionamento e painéis que carregam depois entram no mesmo laço).
    useEffect(() => {
        const element = findTarget(step.target);

        if (element !== null) {
            const tall =
                element.getBoundingClientRect().height >
                window.innerHeight * 0.7;

            element.scrollIntoView({
                block: tall || compact ? 'start' : 'center',
                inline: 'nearest',
                behavior: reducedMotion() ? 'auto' : 'smooth',
            });
        }

        let frame = 0;
        const follow = () => {
            const box = findTarget(step.target)?.getBoundingClientRect();
            const found: Rect | null =
                box === undefined
                    ? null
                    : {
                          left: box.left - PAD,
                          top: box.top - PAD,
                          width: box.width + 2 * PAD,
                          height: box.height + 2 * PAD,
                      };

            setRect((current) => (sameRect(current, found) ? current : found));
            frame = requestAnimationFrame(follow);
        };

        follow();

        return () => cancelAnimationFrame(frame);
    }, [step.target, compact]);

    // O cartão muda de altura com o texto de cada passo.
    useLayoutEffect(() => {
        const element = cardRef.current;

        if (element === null) {
            return;
        }

        const measure = () => {
            const box = element.getBoundingClientRect();

            setCard((current) =>
                Math.abs(current.height - box.height) < 0.5 &&
                Math.abs(current.width - box.width) < 0.5
                    ? current
                    : { width: box.width, height: box.height },
            );
        };

        measure();

        // Sem o observador (ambientes sem layout) vale a medida inicial.
        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(measure);

        observer.observe(element);

        return () => observer.disconnect();
    }, [index]);

    // Teclado no documento inteiro, para valer mesmo se o foco sair do cartão (um clique no fundo).
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                next();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                go(index - 1);
            } else if (event.key === 'Tab') {
                // O foco não sai do cartão: a bancada atrás está bloqueada.
                const focusable = [
                    ...(cardRef.current?.querySelectorAll<HTMLElement>(
                        'button:not([disabled])',
                    ) ?? []),
                ];
                const first = focusable[0];
                const final = focusable[focusable.length - 1];
                const active = document.activeElement;

                if (first === undefined || final === undefined) {
                    return;
                }

                if (!cardRef.current?.contains(active)) {
                    event.preventDefault();
                    first.focus();
                } else if (event.shiftKey && active === first) {
                    event.preventDefault();
                    final.focus();
                } else if (!event.shiftKey && active === final) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', onKeyDown, true);

        return () => document.removeEventListener('keydown', onKeyDown, true);
    });

    // Sem alvo o foco se recolhe no centro da tela e o cartão fica no meio.
    const spot: Rect = rect ?? {
        left: view.width / 2,
        top: view.height / 2,
        width: 0,
        height: 0,
    };
    const placed = placeCard(
        rect,
        { width: compact ? view.width - 24 : card.width, height: card.height },
        view,
        step.sides,
    );
    const position = compact
        ? { left: 12, top: Math.max(12, view.height - card.height - 12) }
        : placed;

    return createPortal(
        // Bloqueia cliques na bancada; o teclado fica preso ao cartão. Fica acima dos diálogos.
        <div className="fixed inset-0 z-[70] tour-in" data-testid="tutorial">
            <div
                aria-hidden="true"
                className="pointer-events-none fixed rounded-xl tour-spot"
                style={{
                    left: spot.left,
                    top: spot.top,
                    width: spot.width,
                    height: spot.height,
                    opacity: rect === null ? 0.001 : 1,
                    boxShadow:
                        '0 0 0 100vmax color-mix(in oklab, black 60%, transparent)',
                }}
            >
                <div className="tour-ring absolute inset-0 rounded-xl border-2 border-accent" />
            </div>
            <div
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={bodyId}
                data-step={step.id}
                className={cn(
                    'fixed top-0 left-0 flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-foreground shadow-2xl tour-card',
                    compact ? 'w-[calc(100vw-1.5rem)]' : 'w-[340px]',
                )}
                style={{
                    transform: `translate(${position.left}px, ${position.top}px)`,
                }}
            >
                <div className="flex items-start justify-between gap-3">
                    <span className="text-section">
                        {t('progress', {
                            current: index + 1,
                            total: STEPS.length,
                        })}
                    </span>
                    <Button
                        variant="quiet"
                        aria-label={t('skip')}
                        onPress={onClose}
                        className="-mt-1 -mr-2 size-7 shrink-0 px-0"
                    >
                        <X aria-hidden="true" className="size-4" />
                    </Button>
                </div>
                <div
                    key={step.id}
                    aria-live="polite"
                    className="flex swap flex-col gap-1.5"
                >
                    <h2 id={titleId} className="text-base font-semibold">
                        {t(`steps.${step.id}.title`)}
                    </h2>
                    <p
                        id={bodyId}
                        className="text-sm leading-relaxed text-muted"
                    >
                        {t(`steps.${step.id}.body`)}
                    </p>
                </div>
                <div
                    role="group"
                    aria-label={t('stepsLabel')}
                    className="flex items-center gap-1.5"
                >
                    {STEPS.map((item, at) => (
                        <button
                            key={item.id}
                            type="button"
                            aria-label={t('goTo', { n: at + 1 })}
                            aria-current={at === index ? 'step' : undefined}
                            onClick={() => go(at)}
                            className={cn(
                                'h-1.5 cursor-default rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-safe:transition-all motion-safe:duration-300',
                                at === index
                                    ? 'w-5 bg-accent'
                                    : at < index
                                      ? 'w-1.5 bg-accent/50'
                                      : 'w-1.5 bg-border',
                            )}
                        />
                    ))}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <Button
                        variant="quiet"
                        disabled={index === 0}
                        onPress={() => go(index - 1)}
                    >
                        <ChevronLeft aria-hidden="true" className="size-4" />
                        {t('back')}
                    </Button>
                    <Button variant="primary" onPress={next} data-tour-next="">
                        {last ? t('finish') : t('next')}
                        {!last && (
                            <ChevronRight
                                aria-hidden="true"
                                className="size-4"
                            />
                        )}
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
