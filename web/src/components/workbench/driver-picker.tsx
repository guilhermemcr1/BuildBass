import { Loader2, Search, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    Autocomplete,
    Dialog,
    DialogTrigger,
    Header,
    Input,
    ListBox,
    ListBoxItem,
    ListBoxSection,
    Modal,
    ModalOverlay,
    TextField,
    useLocale,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { useActiveProject } from '@/hooks/use-active-project';
import { useCatalogPick } from '@/hooks/use-catalog-pick';
import { useDriverBrands } from '@/hooks/use-driver-brands';
import { SEARCH_MIN_LENGTH, useDriverSearch } from '@/hooks/use-driver-search';
import { DIAMETER_BANDS, filtersForBand } from '@/lib/catalog/diameter-bands';
import type { DiameterBandId } from '@/lib/catalog/diameter-bands';
import type { DriverFilters, DriverSummary } from '@/lib/catalog/types';
import type { DriverType } from '@/lib/project/types';
import { formatQuantity, formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { useRecentDrivers } from '@/stores/recent-drivers';
import { useSavedDrivers } from '@/stores/saved-drivers';
import { DriverThumb } from './driver-thumb';

const MINE_PREVIEW = 5;
// Valor da opção "todas" nos filtros (o Select não aceita id vazio).
const ALL = '__all__';

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
    const saved = useSavedDrivers((state) => state.items);
    const applySaved = useActiveProject((state) => state.applySavedDriver);
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const [brand, setBrand] = useState<string | undefined>(undefined);
    const [band, setBand] = useState<DiameterBandId | undefined>(undefined);
    const brands = useDriverBrands(open && !disabled);
    const filters = useMemo<DriverFilters>(
        () => ({
            ...(brand === undefined ? {} : { brand }),
            ...filtersForBand(band),
        }),
        [brand, band],
    );
    const filtered = brand !== undefined || band !== undefined;
    const search = useDriverSearch(term, { offline: disabled, filters });
    const pick = useCatalogPick();

    // "/" abre a busca de qualquer lugar da bancada, menos de dentro de um campo.
    useEffect(() => {
        if (disabled) {
            return;
        }

        const onKey = (event: KeyboardEvent) => {
            const typing =
                event.target instanceof Element &&
                event.target.closest(
                    'input, textarea, select, [contenteditable]',
                ) !== null;

            if (
                event.key === '/' &&
                !typing &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
            ) {
                event.preventDefault();
                setOpen(true);
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    }, [disabled]);
    const searching =
        !disabled && (term.trim().length >= SEARCH_MIN_LENGTH || filtered);
    const catalog = searching ? search.items : [];
    // "Meus alto-falantes" é local: aparece offline e a partir da primeira letra. Sem texto, só os
    // mais recentes; o Autocomplete filtra o resto pelo texto digitado.
    const needle = term.trim().toLowerCase();
    // Com filtro e sem texto só o catálogo responde: "Meus alto-falantes" não tem marca nem faixa
    // de diâmetro para cruzar.
    const mine =
        needle === ''
            ? filtered
                ? []
                : saved.slice(0, MINE_PREVIEW)
            : saved.filter((driver) =>
                  displayName(driver).toLowerCase().includes(needle),
              );

    // Alto-falante salvo pode não ter os três parâmetros; o que falta aparece como "—".
    const support = (driver: {
        fs_hz?: number;
        qts?: number;
        vas_m3?: number;
    }): Pill[] => [
        {
            label: 'Fs',
            value:
                driver.fs_hz === undefined
                    ? '—'
                    : formatWithUnit(
                          driver.fs_hz,
                          defaultUnitFor('frequency', unitSystem),
                          locale,
                      ),
        },
        {
            label: 'Qts',
            value:
                driver.qts === undefined
                    ? '—'
                    : formatQuantity(
                          driver.qts,
                          defaultUnitFor('ratio', unitSystem),
                          locale,
                      ),
        },
        {
            label: 'Vas',
            value:
                driver.vas_m3 === undefined
                    ? '—'
                    : formatWithUnit(
                          driver.vas_m3,
                          defaultUnitFor('volume', unitSystem),
                          locale,
                      ),
        },
    ];

    // "Subwoofer · Ø 12″": só o que o cadastro tem.
    const meta = (driver: { type?: DriverType; nominal_diameter_m?: number }) =>
        [
            driver.type === undefined ? '' : t(`driverType.${driver.type}`),
            driver.nominal_diameter_m === undefined
                ? ''
                : t('catalog.resultDiameter', {
                      diameter: formatWithUnit(
                          driver.nominal_diameter_m,
                          defaultUnitFor('length', unitSystem),
                          locale,
                      ),
                  }),
        ]
            .filter((part) => part !== '')
            .join(' · ');

    const clearFilters = () => {
        setBrand(undefined);
        setBand(undefined);
    };

    const choose = async (summary: DriverSummary) => {
        if (await pick.choose(summary)) {
            setOpen(false);
            setTerm('');
        }
    };

    const onAction = (key: string | number) => {
        const [section, id] = String(key).split(':');

        if (section === 'mine') {
            const driver = saved.find((item) => item.id === id);

            if (driver !== undefined) {
                applySaved(driver);
                setOpen(false);
                setTerm('');
            }

            return;
        }

        const summary =
            section === 'recent'
                ? recents
                      .filter((driver) => driver.id === id)
                      .map((driver): DriverSummary => ({
                          id: driver.id,
                          brand: driver.brand,
                          model: driver.model,
                          variant: driver.variant ?? null,
                          ...(driver.type === undefined
                              ? {}
                              : { type: driver.type }),
                          ...(driver.nominal_diameter_m === undefined
                              ? {}
                              : {
                                    nominal_diameter_m:
                                        driver.nominal_diameter_m,
                                }),
                          ...(driver.cover_thumb_url === undefined
                              ? {}
                              : { cover_thumb_url: driver.cover_thumb_url }),
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
            if (catalog.length === 0 && mine.length === 0) {
                return term.trim().length >= SEARCH_MIN_LENGTH
                    ? t('catalog.empty', { term: term.trim() })
                    : t('picker.emptyFiltered');
            }

            return search.hasMore ? t('catalog.more') : undefined;
        }

        return !searching && recents.length === 0 && mine.length === 0
            ? t('picker.hintFilters')
            : undefined;
    })();

    const itemClass =
        'group flex cursor-default items-center gap-3 rounded-md px-2.5 py-2 outline-none data-[disabled]:opacity-60 data-[focused]:bg-accent/10 data-[focused]:ring-1 data-[focused]:ring-accent/50';
    const headerClass =
        'px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted';
    const showSkeleton =
        searching &&
        search.status === 'loading' &&
        catalog.length === 0 &&
        mine.length === 0;

    return (
        <DialogTrigger isOpen={open} onOpenChange={setOpen}>
            <Button
                variant="secondary"
                aria-keyshortcuts="/"
                className="h-9 w-full min-w-0 justify-start gap-2 px-3 font-normal text-muted"
            >
                <Search aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">
                    {t('picker.triggerHint')}
                </span>
                <kbd
                    aria-hidden="true"
                    className="rounded border border-border bg-background px-1.5 text-[11px] leading-5"
                >
                    /
                </kbd>
            </Button>
            <ModalOverlay
                isDismissable
                className="fixed inset-0 z-50 flex overlay-motion items-start justify-center bg-black/50 p-4 pt-[10dvh]"
            >
                <Modal className="w-full max-w-xl modal-motion overflow-hidden rounded-lg border border-border bg-surface text-foreground shadow-xl">
                    <Dialog
                        aria-label={t('picker.label')}
                        className="flex max-h-[80dvh] flex-col outline-none"
                    >
                        <Autocomplete inputValue={term} onInputChange={setTerm}>
                            <TextField
                                aria-label={t('picker.label')}
                                autoFocus
                                className="flex h-12 items-center gap-3 border-b border-border px-4 focus-within:bg-raised"
                            >
                                {search.status === 'loading' && searching ? (
                                    <Loader2
                                        aria-hidden="true"
                                        className="size-5 shrink-0 animate-spin text-accent"
                                    />
                                ) : (
                                    <Search
                                        aria-hidden="true"
                                        className="size-5 shrink-0 text-muted"
                                    />
                                )}
                                <Input
                                    type="search"
                                    placeholder={t('picker.placeholder')}
                                    className="h-full w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:appearance-none"
                                />
                                {term !== '' && (
                                    <button
                                        type="button"
                                        aria-label={t('picker.clearSearch')}
                                        onClick={() => setTerm('')}
                                        className="rounded p-1 text-muted hover:bg-background hover:text-foreground"
                                    >
                                        <X
                                            aria-hidden="true"
                                            className="size-4"
                                        />
                                    </button>
                                )}
                            </TextField>
                            {!disabled && (
                                <div className="flex items-end gap-2 border-b border-border bg-background/40 px-4 py-2.5">
                                    <SelectField<string>
                                        label={t('picker.brand')}
                                        selected={brand ?? ALL}
                                        onChange={(id) =>
                                            setBrand(
                                                id === ALL ? undefined : id,
                                            )
                                        }
                                        options={[
                                            {
                                                id: ALL,
                                                label: t('picker.brandAny'),
                                            },
                                            ...brands.map((name) => ({
                                                id: name,
                                                label: name,
                                            })),
                                        ]}
                                        className="min-w-0 flex-1"
                                    />
                                    <SelectField<string>
                                        label={t('picker.diameter')}
                                        selected={band ?? ALL}
                                        onChange={(id) =>
                                            setBand(
                                                id === ALL
                                                    ? undefined
                                                    : (id as DiameterBandId),
                                            )
                                        }
                                        options={[
                                            {
                                                id: ALL,
                                                label: t('picker.diameterAny'),
                                            },
                                            ...DIAMETER_BANDS.map((item) => ({
                                                id: item.id,
                                                label: item.label,
                                            })),
                                        ]}
                                        className="w-32 shrink-0"
                                    />
                                    {filtered && (
                                        <Button
                                            variant="quiet"
                                            onPress={clearFilters}
                                            className="shrink-0 px-2 text-xs"
                                        >
                                            {t('picker.clearFilters')}
                                        </Button>
                                    )}
                                </div>
                            )}
                            {showSkeleton && <ResultSkeleton />}
                            <ListBox
                                aria-label={t('picker.label')}
                                onAction={onAction}
                                className="min-h-0 flex-1 overflow-auto p-2 outline-none empty:hidden"
                            >
                                {mine.length > 0 && (
                                    <ListBoxSection>
                                        <Header className={headerClass}>
                                            {t('picker.mine')}
                                        </Header>
                                        {mine.map((driver) => (
                                            <ListBoxItem
                                                key={driver.id}
                                                id={`mine:${driver.id}`}
                                                textValue={displayName(driver)}
                                                className={itemClass}
                                            >
                                                <Entry
                                                    name={displayName(driver)}
                                                    term={term}
                                                    meta={meta(driver)}
                                                    pills={support(
                                                        driver.driver,
                                                    )}
                                                    thumb={{ url: undefined }}
                                                />
                                            </ListBoxItem>
                                        ))}
                                    </ListBoxSection>
                                )}
                                {!searching && recents.length > 0 && (
                                    <ListBoxSection>
                                        <Header className={headerClass}>
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
                                                    term={term}
                                                    meta={meta(driver)}
                                                    pills={support(driver)}
                                                    thumb={{
                                                        url: driver.cover_thumb_url,
                                                    }}
                                                />
                                            </ListBoxItem>
                                        ))}
                                    </ListBoxSection>
                                )}
                                {catalog.length > 0 && (
                                    <ListBoxSection>
                                        <Header className={headerClass}>
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
                                                    term={term}
                                                    meta={meta(driver)}
                                                    pills={support(driver)}
                                                    thumb={{
                                                        url: driver.cover_thumb_url,
                                                    }}
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
                            className="px-4 py-2 text-xs text-muted empty:hidden"
                        >
                            {status}
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-border bg-background/40 px-4 py-2.5 text-xs text-muted">
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
                </Modal>
            </ModalOverlay>
        </DialogTrigger>
    );
}

type Pill = { label: string; value: string };

// Destaca no nome o que a pessoa digitou (cada palavra, sem diferenciar maiúsculas). O texto
// continua o mesmo, só ganha `<mark>`: o nome acessível do item não muda.
function Highlight({ text, term }: { text: string; term: string }) {
    const words = term
        .trim()
        .split(/\s+/)
        .filter((word) => word !== '')
        .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (words.length === 0) {
        return text;
    }

    const parts = text.split(new RegExp(`(${words.join('|')})`, 'gi'));

    return parts.map((part, index) =>
        index % 2 === 1 ? (
            <mark
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className="rounded-sm bg-accent/25 px-0.5 font-semibold text-foreground"
            >
                {part}
            </mark>
        ) : (
            part
        ),
    );
}

function Entry({
    name,
    term,
    meta,
    pills,
    thumb,
}: {
    name: string;
    term: string;
    meta: string;
    pills: Pill[];
    // Só o catálogo tem miniatura; sem imagem, o quadro reservado mantém o alinhamento. A imagem
    // é decorativa: o nome está ao lado.
    thumb?: { url: string | undefined };
}) {
    return (
        <>
            {thumb !== undefined && (
                <DriverThumb
                    url={thumb.url}
                    alt=""
                    className="size-14 rounded-md"
                />
            )}
            <span className="block min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                    <Highlight text={name} term={term} />
                </span>
                {meta !== '' && (
                    <span className="block truncate text-xs text-muted">
                        {meta}
                    </span>
                )}
                <span className="mt-1 flex flex-wrap gap-1.5">
                    {pills.map((pill) => (
                        <span
                            key={pill.label}
                            className="rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted tabular-nums"
                        >
                            {pill.label}{' '}
                            <span className="font-medium text-foreground">
                                {pill.value}
                            </span>
                        </span>
                    ))}
                </span>
            </span>
        </>
    );
}

// Linhas-fantasma enquanto o catálogo responde: a lista não "pula" quando os resultados chegam.
function ResultSkeleton() {
    return (
        <div aria-hidden="true" className="space-y-2 p-3">
            {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                    <div className="size-14 shrink-0 animate-pulse rounded-md bg-background" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 animate-pulse rounded bg-background" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-background" />
                    </div>
                </div>
            ))}
        </div>
    );
}
