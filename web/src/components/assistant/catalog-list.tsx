import { Check, Loader2, Search } from 'lucide-react';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Input, SearchField, useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { FIELD_BOX, FIELD_INPUT } from '@/components/ui/field-box';
import { DriverThumb } from '@/components/workbench/driver-thumb';
import { useActiveProject } from '@/hooks/use-active-project';
import { useCatalogPick } from '@/hooks/use-catalog-pick';
import { SEARCH_MAX_LENGTH, useDriverSearch } from '@/hooks/use-driver-search';
import type { DriverSummary } from '@/lib/catalog/types';
import { formatQuantity, formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';

function nameOf(driver: {
    brand?: string;
    model?: string;
    variant?: string | null;
}): string {
    const name = `${driver.brand ?? ''} ${driver.model ?? ''}`.trim();

    return driver.variant == null ? name : `${name} (${driver.variant})`;
}

type CatalogListProps = {
    offline: boolean;
    onPicked: () => void;
    // Foca a busca ao abrir, só com mouse/trackpad: no celular abriria o teclado por cima da lista.
    autoFocus?: boolean;
};

const finePointer = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: fine)').matches === true;

// Lista do catálogo já aberta no passo do alto-falante: sem texto mostra o catálogo para navegar,
// e cada letra refina. Escolher copia o driver para o projeto (o mesmo caminho da bancada).
export function CatalogList({
    offline,
    onPicked,
    autoFocus = false,
}: CatalogListProps) {
    const { t } = useTranslation('assistant');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const source = useActiveProject((state) => state.data.driverSource);
    const [term, setTerm] = useState('');
    const search = useDriverSearch(term, { offline });
    const pick = useCatalogPick();
    const [choosing, setChoosing] = useState<string>();
    const current = source === undefined ? '' : nameOf(source);

    const choose = async (summary: DriverSummary) => {
        setChoosing(summary.id);
        const ok = await pick.choose(summary);
        setChoosing(undefined);

        if (ok) {
            onPicked();
        }
    };

    if (offline) {
        return <Banner tone="warn">{t('driver.catalog.offline')}</Banner>;
    }

    return (
        <div className="flex min-h-0 flex-col gap-2.5">
            <SearchField
                aria-label={t('driver.catalog.search')}
                value={term}
                onChange={setTerm}
                className={cn(FIELD_BOX, 'h-10')}
            >
                <Search
                    aria-hidden="true"
                    className="ml-2.5 size-4 self-center text-muted"
                />
                <Input
                    autoFocus={autoFocus && finePointer()}
                    maxLength={SEARCH_MAX_LENGTH}
                    placeholder={t('driver.catalog.placeholder')}
                    className={FIELD_INPUT}
                />
            </SearchField>
            {pick.applyError !== undefined && (
                <Banner tone="warn">{t('driver.catalog.applyError')}</Banner>
            )}
            {search.status === 'error' && (
                <div className="flex flex-wrap items-center gap-2">
                    <Banner tone="warn" className="flex-1">
                        {t('driver.catalog.error')}
                    </Banner>
                    <Button onPress={search.retry}>
                        {t('driver.catalog.retry')}
                    </Button>
                </div>
            )}
            {search.status === 'loading' && search.items.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-muted">
                    <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                    />
                    {t('driver.catalog.loading')}
                </p>
            )}
            {search.status === 'ready' && search.items.length === 0 && (
                <p className="text-sm text-muted">
                    {t('driver.catalog.empty')}
                </p>
            )}
            <ul
                aria-label={t('driver.catalog.results')}
                className="flex flex-col gap-1.5"
            >
                {search.items.map((item, position) => {
                    const name = nameOf(item);
                    const selected = name === current;

                    return (
                        <li
                            key={item.id}
                            className="stagger"
                            style={
                                {
                                    '--i': Math.min(position, 8),
                                } as CSSProperties
                            }
                        >
                            <Button
                                variant="quiet"
                                aria-pressed={selected}
                                disabled={pick.applying}
                                onPress={() => void choose(item)}
                                className={cn(
                                    'h-auto w-full justify-start gap-3 rounded-lg border border-border bg-surface px-2.5 py-2 text-left data-[hovered]:border-accent/60 data-[hovered]:bg-raised motion-safe:transition-[border-color,background-color] motion-safe:duration-200',
                                    selected && 'border-accent bg-accent/10',
                                )}
                            >
                                <DriverThumb
                                    url={item.cover_thumb_url}
                                    alt=""
                                    className="size-12 shrink-0 rounded-md"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                        {name}
                                    </span>
                                    <span className="mt-0.5 block truncate text-xs text-muted tabular-nums">
                                        Fs{' '}
                                        {formatWithUnit(
                                            item.fs_hz,
                                            'Hz',
                                            locale,
                                        )}{' '}
                                        · Qts{' '}
                                        {formatQuantity(
                                            item.qts,
                                            'none',
                                            locale,
                                        )}{' '}
                                        · Vas{' '}
                                        {formatWithUnit(
                                            item.vas_m3,
                                            defaultUnitFor(
                                                'volume',
                                                unitSystem,
                                            ),
                                            locale,
                                        )}
                                    </span>
                                </span>
                                {choosing === item.id ? (
                                    <Loader2
                                        aria-hidden="true"
                                        className="size-4 shrink-0 animate-spin"
                                    />
                                ) : (
                                    selected && (
                                        <Check
                                            aria-hidden="true"
                                            className="size-4 shrink-0 text-accent"
                                        />
                                    )
                                )}
                            </Button>
                        </li>
                    );
                })}
            </ul>
            {search.hasMore && (
                <Button
                    onPress={search.loadMore}
                    disabled={search.loadingMore}
                    className="self-center"
                >
                    {search.loadingMore && (
                        <Loader2
                            aria-hidden="true"
                            className="size-4 animate-spin"
                        />
                    )}
                    {t('driver.catalog.more')}
                </Button>
            )}
        </div>
    );
}
