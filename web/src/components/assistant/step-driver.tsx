import {
    ArrowLeft,
    ArrowRight,
    Check,
    CircleCheck,
    CircleDashed,
    ClipboardPaste,
    Eraser,
    FileUp,
    Keyboard,
    Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DriverField } from '@/components/workbench/driver-field';
import { DriverIdentity } from '@/components/workbench/driver-identity';
import { deriveDriver } from '@/engine';
import type { DriverKey } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useDriverAiFill } from '@/hooks/use-driver-ai-fill';
import { clearDriverSpecifics, withIdentity } from '@/lib/project/fields';
import { PARAMETERS } from '@/lib/parameters';
import { cn } from '@/lib/utils';
import { AiOutcome, PdfSource, TextSource } from './ai-sources';
import { CatalogList } from './catalog-list';
import { DRIVER_MINIMUM } from './readiness';

export type DriverSource = 'catalog' | 'pdf' | 'text' | 'typing';

// Abre no catálogo, com as alternativas (PDF ou texto com IA, digitar) à vista ao lado; PDF e texto
// abrem em tela própria; por fim a pessoa confere e completa os dados. Digitar vai direto aos dados.
export type DriverPhase = 'find' | 'source' | 'data';

// Os que o assistente mostra: o mínimo para simular e os que dão impedância, excursão e potência.
const SHOWN: DriverKey[] = [
    'fs_hz',
    'qts',
    'vas_m3',
    're_ohm',
    'sd_m2',
    'xmax_m',
    'pe_w',
    'qes',
    'qms',
];
const MORE: DriverKey[] = ['le_h', 'bl_tm', 'mms_kg'];

type StepDriverProps = {
    offline: boolean;
    phase: DriverPhase;
    onPhase: (phase: DriverPhase) => void;
};

const SOURCE_ICONS = {
    pdf: FileUp,
    text: ClipboardPaste,
    typing: Keyboard,
} as const;

const OTHER_SOURCES = ['pdf', 'text', 'typing'] as const;

// Passo 1 em três momentos, um de cada vez na tela, para não ter de acompanhar duas colunas.
export function StepDriver({ offline, phase, onPhase }: StepDriverProps) {
    const { t } = useTranslation('assistant');
    const [source, setSource] = useState<DriverSource>();
    // Avançar (catálogo → fonte → dados) entra pela direita; voltar ao catálogo, pela esquerda.
    const [direction, setDirection] = useState<'forward' | 'back'>('forward');
    const fill = useDriverAiFill();
    const done = fill.state.status === 'done';

    // A IA terminou de ler: segue para os dados, com o resultado no topo.
    useEffect(() => {
        if (done) {
            setDirection('forward');
            onPhase('data');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [done]);

    const choose = (next: (typeof OTHER_SOURCES)[number]) => {
        setSource(next);
        fill.reset();
        setDirection('forward');
        onPhase(next === 'typing' ? 'data' : 'source');
    };

    const backToCatalog = () => {
        fill.reset();
        setDirection('back');
        onPhase('find');
    };

    const motion = direction === 'back' ? 'step-back' : 'step-forward';

    if (phase === 'find') {
        const aiLocked = offline || fill.unavailable;

        return (
            <div
                key="find"
                className={cn(
                    'grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]',
                    motion,
                )}
            >
                <section
                    aria-labelledby="assistant-driver-find"
                    className="flex min-w-0 flex-col gap-3"
                >
                    <header>
                        <h3
                            id="assistant-driver-find"
                            className="text-base font-semibold"
                        >
                            {t('driver.findTitle')}
                        </h3>
                        <p className="text-xs text-muted">
                            {t('driver.findHint')}
                        </p>
                    </header>
                    <CatalogList
                        offline={offline}
                        autoFocus
                        onPicked={() => {
                            setSource('catalog');
                            setDirection('forward');
                            onPhase('data');
                        }}
                    />
                </section>
                {/* Alternativas sempre à vista: ao lado no desktop, logo depois da lista no celular. */}
                <aside
                    aria-labelledby="assistant-driver-other"
                    className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 lg:sticky lg:top-0"
                >
                    <header>
                        <h3
                            id="assistant-driver-other"
                            className="text-sm font-semibold"
                        >
                            {t('driver.otherTitle')}
                        </h3>
                        <p className="text-xs text-muted">
                            {t('driver.otherHint')}
                        </p>
                    </header>
                    <ul className="flex flex-col gap-2">
                        {OTHER_SOURCES.map((id, position) => {
                            const Icon = SOURCE_ICONS[id];
                            const locked = id !== 'typing' && aiLocked;

                            return (
                                <li
                                    key={id}
                                    className="stagger"
                                    style={
                                        { '--i': position + 2 } as CSSProperties
                                    }
                                >
                                    <Button
                                        variant="quiet"
                                        disabled={locked}
                                        onPress={() => choose(id)}
                                        className="group h-auto w-full items-start justify-start gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-left whitespace-normal data-[disabled]:bg-background data-[hovered]:border-accent/70 data-[hovered]:bg-raised data-[pressed]:scale-[0.985] data-[pressed]:bg-raised motion-safe:transition-[border-color,background-color,transform] motion-safe:duration-200"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="grid size-9 shrink-0 place-items-center rounded-md bg-accent/12 text-accent-soft group-data-[disabled]:bg-raised group-data-[disabled]:text-disabled group-data-[hovered]:bg-accent group-data-[hovered]:text-accent-foreground motion-safe:transition-colors motion-safe:duration-200"
                                        >
                                            <Icon className="size-[18px]" />
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <span className="flex items-center gap-2 text-sm font-semibold">
                                                {t(`driver.sources.${id}`)}
                                                {id !== 'typing' && (
                                                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/12 px-1.5 py-px text-[10px] font-semibold tracking-wide text-accent-soft uppercase">
                                                        <Sparkles
                                                            aria-hidden="true"
                                                            className="size-3"
                                                        />
                                                        {t('driver.aiBadge')}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-xs leading-relaxed font-normal text-muted">
                                                {locked
                                                    ? t('driver.sourceLocked')
                                                    : t(
                                                          `driver.sourceHints.${id}`,
                                                      )}
                                            </span>
                                        </span>
                                        <ArrowRight
                                            aria-hidden="true"
                                            className="mt-2.5 size-4 shrink-0 -translate-x-1 text-accent-soft opacity-0 group-data-[focus-visible]:translate-x-0 group-data-[focus-visible]:opacity-100 group-data-[hovered]:translate-x-0 group-data-[hovered]:opacity-100 motion-safe:transition-[opacity,transform] motion-safe:duration-200"
                                        />
                                    </Button>
                                </li>
                            );
                        })}
                    </ul>
                </aside>
            </div>
        );
    }

    if (phase === 'source' && (source === 'pdf' || source === 'text')) {
        return (
            <section
                key={`source-${source}`}
                aria-labelledby="assistant-driver-source"
                className={cn('flex flex-col gap-4', motion)}
            >
                <SourceHeader
                    title={t(`driver.sources.${source}`)}
                    onBack={backToCatalog}
                />
                {source === 'pdf' && <PdfSource fill={fill} />}
                {source === 'text' && <TextSource fill={fill} />}
            </section>
        );
    }

    return (
        <div key="data" className={cn('flex flex-col gap-4', motion)}>
            <SourceHeader
                title={t('driver.dataTitle')}
                subtitle={
                    source === undefined
                        ? undefined
                        : t('driver.cameFrom', {
                              source: t(`driver.sources.${source}`),
                          })
                }
                onBack={backToCatalog}
            />
            {done && <AiOutcome fill={fill} />}
            {source === 'typing' && (
                <p className="text-sm text-muted">{t('driver.typingHint')}</p>
            )}
            <DriverData />
        </div>
    );
}

function SourceHeader({
    title,
    subtitle,
    onBack,
}: {
    title: string;
    subtitle?: string;
    onBack: () => void;
}) {
    const { t } = useTranslation('assistant');

    return (
        <header className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
                <h3
                    id="assistant-driver-source"
                    className="text-base font-semibold"
                >
                    {title}
                </h3>
                {subtitle !== undefined && (
                    <p className="text-xs text-muted">{subtitle}</p>
                )}
            </div>
            <Button variant="quiet" onPress={onBack} className="group">
                <ArrowLeft
                    aria-hidden="true"
                    className="size-4 group-data-[hovered]:-translate-x-0.5 motion-safe:transition-transform motion-safe:duration-200"
                />
                {t('driver.backToCatalog')}
            </Button>
        </header>
    );
}

function DriverData() {
    const { t } = useTranslation('assistant');
    const driver = useActiveProject((state) => state.data.driver);
    const hasData = useActiveProject(
        (state) =>
            Object.keys(state.data.driver).length > 0 ||
            state.data.driverSource !== undefined,
    );
    const apply = useActiveProject((state) => state.apply);
    const [more, setMore] = useState(false);
    const derived = deriveDriver(driver);
    const missing = DRIVER_MINIMUM.filter(
        (key) => derived.values[key].value === undefined,
    );

    return (
        <section
            aria-labelledby="assistant-driver-data"
            className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4"
        >
            <header className="flex flex-wrap items-center justify-between gap-2">
                <h4
                    id="assistant-driver-data"
                    className="text-sm font-semibold"
                >
                    {t('driver.values')}
                </h4>
                {hasData && (
                    <Button
                        variant="quiet"
                        onPress={() =>
                            apply((data) =>
                                withIdentity(
                                    clearDriverSpecifics({
                                        ...data,
                                        driver: {},
                                    }),
                                    {
                                        brand: undefined,
                                        model: undefined,
                                        variant: undefined,
                                        type: undefined,
                                    },
                                ),
                            )
                        }
                    >
                        <Eraser aria-hidden="true" className="size-4" />
                        {t('driver.clear')}
                    </Button>
                )}
            </header>
            <div
                role="status"
                className={cn(
                    'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border px-3 py-2.5 text-sm motion-safe:transition-[background-color,border-color] motion-safe:duration-300',
                    missing.length === 0
                        ? 'border-accent/40 bg-accent/10'
                        : 'border-border bg-raised/60',
                )}
            >
                <span className="flex items-start gap-2">
                    {missing.length === 0 ? (
                        <CircleCheck
                            key="ready"
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 check-draw text-accent-soft"
                        />
                    ) : (
                        <CircleDashed
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-muted"
                        />
                    )}
                    <span
                        className={
                            missing.length === 0
                                ? 'text-foreground'
                                : 'text-muted'
                        }
                    >
                        {missing.length === 0
                            ? t('driver.ready')
                            : t('driver.missing', {
                                  fields: missing
                                      .map((key) => PARAMETERS[key].symbol)
                                      .join(', '),
                              })}
                    </span>
                </span>
                {/* O mínimo como checklist: cada parâmetro acende quando tem valor. */}
                <span aria-hidden="true" className="flex gap-1.5">
                    {DRIVER_MINIMUM.map((key) => {
                        const filled = !missing.includes(key);

                        return (
                            <span
                                key={key}
                                className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 num text-[11px] motion-safe:transition-[background-color,border-color,color] motion-safe:duration-300',
                                    filled
                                        ? 'border-accent bg-accent text-accent-foreground'
                                        : 'border-border text-muted',
                                )}
                            >
                                {filled && (
                                    <Check
                                        strokeWidth={3}
                                        className="size-3 check-draw"
                                    />
                                )}
                                {PARAMETERS[key].symbol}
                            </span>
                        );
                    })}
                </span>
            </div>
            <DriverIdentity />
            <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2 sm:grid-cols-3">
                {(more ? [...SHOWN, ...MORE] : SHOWN).map((key) => (
                    <DriverField key={key} parameter={key} derived={derived} />
                ))}
            </div>
            <Button
                variant="quiet"
                onPress={() => setMore(!more)}
                aria-expanded={more}
                className="self-start text-xs"
            >
                {more ? t('driver.fewer') : t('driver.more')}
            </Button>
            <p className="text-xs text-muted">{t('driver.minimumNote')}</p>
        </section>
    );
}
