import { Loader2, Search, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { FIELD_BOX } from '@/components/ui/field-box';
import { SelectField } from '@/components/ui/select-field';
import { cn } from '@/lib/utils';
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
    }) =>
        t('catalog.resultSupport', {
            fs:
                driver.fs_hz === undefined
                    ? '—'
                    : formatWithUnit(
                          driver.fs_hz,
                          defaultUnitFor('frequency', unitSystem),
                          locale,
                      ),
            qts:
                driver.qts === undefined
                    ? '—'
                    : formatQuantity(
                          driver.qts,
                          defaultUnitFor('ratio', unitSystem),
                          locale,
                      ),
            vas:
                driver.vas_m3 === undefined
                    ? '—'
                    : formatWithUnit(
                          driver.vas_m3,
                          defaultUnitFor('volume', unitSystem),
                          locale,
                      ),
        });

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
                className="w-80 max-w-[calc(100vw-1.5rem)] pop rounded-md border border-border bg-raised p-2 shadow-lg"
            >
                <Dialog aria-label={t('picker.label')} className="outline-none">
                    <Autocomplete inputValue={term} onInputChange={setTerm}>
                        <TextField
                            aria-label={t('picker.label')}
                            autoFocus
                            className={cn(
                                FIELD_BOX,
                                'mb-1 items-center gap-2 px-2.5',
                            )}
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
                        {!disabled && (
                            <div className="mb-1 flex items-end gap-2">
                                <SelectField<string>
                                    label={t('picker.brand')}
                                    selected={brand ?? ALL}
                                    onChange={(id) =>
                                        setBrand(id === ALL ? undefined : id)
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
                                    className="w-28 shrink-0"
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
                        <ListBox
                            aria-label={t('picker.label')}
                            onAction={onAction}
                            className="max-h-64 overflow-auto outline-none"
                        >
                            {mine.length > 0 && (
                                <ListBoxSection>
                                    <Header className="px-2.5 py-1 text-xs font-semibold text-muted">
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
                                                meta={meta(driver)}
                                                support={support(driver.driver)}
                                            />
                                        </ListBoxItem>
                                    ))}
                                </ListBoxSection>
                            )}
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
                                                meta={meta(driver)}
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
                                                meta={meta(driver)}
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

function Entry({
    name,
    meta,
    support,
}: {
    name: string;
    meta: string;
    support: string;
}) {
    return (
        <>
            <span className="block">{name}</span>
            {meta !== '' && (
                <span className="block text-[11px] text-foreground">
                    {meta}
                </span>
            )}
            <span className="block text-[11px] text-muted tabular-nums">
                {support}
            </span>
        </>
    );
}
