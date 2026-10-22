import { Loader2, Search, Send } from 'lucide-react';
import { useState } from 'react';
import {
    Autocomplete,
    Dialog,
    DialogTrigger,
    Header,
    Input,
    ListBox,
    ListBoxItem,
    ListBoxSection,
    Popover,
    TextField,
    useLocale,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useCatalogPick } from '@/hooks/use-catalog-pick';
import { SEARCH_MIN_LENGTH, useDriverSearch } from '@/hooks/use-driver-search';
import type { DriverSummary } from '@/lib/catalog/types';
import { formatQuantity, formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { useRecentDrivers } from '@/stores/recent-drivers';

type DriverPickerProps = {
    disabled?: boolean;
    disabledReason?: string;
    onSubmitDriver: () => void;
};

function displayName(driver: {
    brand: string;
    model: string;
    variant?: string | null;
}): string {
    const name = `${driver.brand} ${driver.model}`;

    return driver.variant == null ? name : `${name} (${driver.variant})`;
}

// Busca de drivers num botão só: abre um popover com o campo e as sugestões (recentes quando o
// campo está vazio, catálogo a partir de 2 letras). Economiza o espaço que o campo fixo ocupava.
export function DriverPicker({
    disabled = false,
    disabledReason,
    onSubmitDriver,
}: DriverPickerProps) {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const recents = useRecentDrivers((state) => state.items);
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const search = useDriverSearch(term, { offline: disabled });
    const pick = useCatalogPick();
    const searching = !disabled && term.trim().length >= SEARCH_MIN_LENGTH;
    const catalog = searching ? search.items : [];

    const support = (driver: { fs_hz: number; qts: number; vas_m3: number }) =>
        t('catalog.resultSupport', {
            fs: formatWithUnit(
                driver.fs_hz,
                defaultUnitFor('frequency', unitSystem),
                locale,
            ),
            qts: formatQuantity(
                driver.qts,
                defaultUnitFor('ratio', unitSystem),
                locale,
            ),
            vas: formatWithUnit(
                driver.vas_m3,
                defaultUnitFor('volume', unitSystem),
                locale,
            ),
        });

    const choose = async (summary: DriverSummary) => {
        if (await pick.choose(summary)) {
            setOpen(false);
            setTerm('');
        }
    };

    const onAction = (key: string | number) => {
        const [section, id] = String(key).split(':');
        const summary =
            section === 'recent'
                ? recents
                      .filter((driver) => driver.id === id)
                      .map((driver): DriverSummary => ({
                          id: driver.id,
                          brand: driver.brand,
                          model: driver.model,
                          variant: driver.variant ?? null,
                          fs_hz: driver.fs_hz,
                          qts: driver.qts,
                          vas_m3: driver.vas_m3,
                      }))[0]
                : catalog.find((driver) => driver.id === id);

        if (summary !== undefined) {
            void choose(summary);
        }
    };

    const status = (() => {
        if (disabled) {
            return disabledReason ?? t('picker.offline');
        }

        if (pick.applying) {
            return t('catalog.applying');
        }

        if (pick.applyError !== undefined) {
            return pick.applyError === 'notFound'
                ? t('catalog.notFound')
                : t('catalog.applyFailed');
        }

        if (searching && search.status === 'error') {
            return (
                <span className="flex flex-wrap items-center gap-2">
                    {t('catalog.error')}
                    <Button variant="quiet" onPress={search.retry}>
                        {t('catalog.retry')}
                    </Button>
                </span>
            );
        }

        if (searching && search.status === 'loading') {
            return t('catalog.searching');
        }

        if (searching && search.status === 'ready') {
            if (catalog.length === 0) {
                return t('catalog.empty', { term: term.trim() });
            }

            return search.hasMore ? t('catalog.more') : undefined;
        }

        return !searching && recents.length === 0
            ? t('picker.hint')
            : undefined;
    })();

    const itemClass =
        'cursor-default rounded-sm px-2.5 py-1.5 text-sm outline-none data-[disabled]:opacity-60 data-[focused]:bg-surface';

    return (
        <DialogTrigger isOpen={open} onOpenChange={setOpen}>
            <Button variant="secondary" className="shrink-0">
                <Search aria-hidden="true" className="size-4" />
                {t('picker.open')}
            </Button>
            <Popover
                placement="bottom start"
                offset={4}
                className="w-80 max-w-[calc(100vw-1.5rem)] rounded-md border border-border bg-raised p-2 shadow-lg"
            >
                <Dialog aria-label={t('picker.label')} className="outline-none">
                    <Autocomplete inputValue={term} onInputChange={setTerm}>
                        <TextField
                            aria-label={t('picker.label')}
                            autoFocus
                            isDisabled={disabled}
                            className="mb-1 flex h-[34px] items-center gap-2 rounded-md border border-border bg-surface px-2.5 focus-within:border-accent"
                        >
                            {search.status === 'loading' && searching ? (
                                <Loader2
                                    aria-hidden="true"
                                    className="size-4 shrink-0 animate-spin text-muted"
                                />
                            ) : (
                                <Search
                                    aria-hidden="true"
                                    className="size-4 shrink-0 text-muted"
                                />
                            )}
                            <Input
                                type="search"
                                placeholder={t('picker.placeholder')}
                                className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed [&::-webkit-search-cancel-button]:appearance-none"
                            />
                        </TextField>
                        <ListBox
                            aria-label={t('picker.label')}
                            onAction={onAction}
                            className="max-h-64 overflow-auto outline-none"
                        >
                            {!searching && recents.length > 0 && (
                                <ListBoxSection>
                                    <Header className="px-2.5 py-1 text-xs font-semibold text-muted">
                                        {t('picker.recent')}
                                    </Header>
                                    {recents.map((driver) => (
                                        <ListBoxItem
                                            key={driver.id}
                                            id={`recent:${driver.id}`}
                                            textValue={displayName(driver)}
                                            isDisabled={disabled}
                                            className={itemClass}
                                        >
                                            <Entry
                                                name={displayName(driver)}
                                                support={support(driver)}
                                            />
                                        </ListBoxItem>
                                    ))}
                                </ListBoxSection>
                            )}
                            {catalog.length > 0 && (
                                <ListBoxSection>
                                    <Header className="px-2.5 py-1 text-xs font-semibold text-muted">
                                        {t('picker.catalog')}
                                    </Header>
                                    {catalog.map((driver) => (
                                        <ListBoxItem
                                            key={driver.id}
                                            id={`catalog:${driver.id}`}
                                            textValue={displayName(driver)}
                                            className={itemClass}
                                        >
                                            <Entry
                                                name={displayName(driver)}
                                                support={support(driver)}
                                            />
                                        </ListBoxItem>
                                    ))}
                                </ListBoxSection>
                            )}
                        </ListBox>
                    </Autocomplete>
                    <div
                        role="status"
                        aria-live="polite"
                        className="px-2.5 py-1 text-[11px] text-muted empty:hidden"
                    >
                        {status}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 border-t border-border px-1 pt-2 text-xs text-muted">
                        {t('picker.notFoundHelp')}
                        <Button
                            variant="quiet"
                            disabled={disabled}
                            onPress={() => {
                                setOpen(false);
                                onSubmitDriver();
                            }}
                        >
                            <Send aria-hidden="true" className="size-4" />
                            {t('picker.submit')}
                        </Button>
                    </div>
                </Dialog>
            </Popover>
        </DialogTrigger>
    );
}

function Entry({ name, support }: { name: string; support: string }) {
    return (
        <>
            <span className="block">{name}</span>
            <span className="block text-[11px] text-muted tabular-nums">
                {support}
            </span>
        </>
    );
}
