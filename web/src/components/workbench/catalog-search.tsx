import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { SearchSelect } from '@/components/ui/search-select';
import type { SearchOption } from '@/components/ui/search-select';
import { activeProjectStore } from '@/hooks/use-active-project';
import { SEARCH_MIN_LENGTH, useDriverSearch } from '@/hooks/use-driver-search';
import { fetchDriver } from '@/lib/catalog/client';
import { toDriverInput } from '@/lib/catalog/to-driver-input';
import type { CatalogError, DriverSummary } from '@/lib/catalog/types';
import { formatQuantity, formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

type CatalogSearchProps = {
    disabled?: boolean;
    disabledReason?: string;
    className?: string;
};

function displayName(driver: DriverSummary): string {
    const name = `${driver.brand} ${driver.model}`;

    return driver.variant === null ? name : `${name} (${driver.variant})`;
}

// Campo do catálogo (US1): busca no servidor e copia o driver escolhido para o projeto ativo.
export function CatalogSearch({
    disabled = false,
    disabledReason,
    className,
}: CatalogSearchProps) {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const [term, setTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [applying, setApplying] = useState(false);
    // Depois de escolher, a lista fecha (o ComboBox só fecha sozinho quando a coleção esvazia);
    // ela volta quando o usuário digita de novo.
    const [dismissed, setDismissed] = useState(false);
    const [applyError, setApplyError] = useState<CatalogError>();
    const search = useDriverSearch(term, { offline: disabled });

    const support = (driver: DriverSummary) =>
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

    const items: SearchOption[] = (dismissed ? [] : search.items).map(
        (driver) => ({
            id: String(driver.id),
            label: displayName(driver),
            description: support(driver),
        }),
    );

    const searching = !disabled && term.trim().length >= SEARCH_MIN_LENGTH;
    const failed = search.status === 'error';

    // Escolher = buscar o detalhe e só então copiar (FR-009): se algo falhar, o projeto e o texto
    // digitado ficam como estavam.
    const choose = async (id: string) => {
        if (applying) {
            return;
        }

        setApplying(true);
        setDismissed(true);
        setApplyError(undefined);
        const result = await fetchDriver(Number(id));
        setApplying(false);

        if (!result.ok) {
            setApplyError(result.aborted ? 'network' : result.error);

            return;
        }

        const { driver, source } = toDriverInput(result.data.data);
        activeProjectStore().getState().applyCatalogDriver(driver, source);
        setTerm('');
    };

    const emptyMessage = (() => {
        if (search.status === 'loading') {
            return t('catalog.searching');
        }

        return search.status === 'ready' && items.length === 0
            ? t('catalog.empty', { term: term.trim() })
            : undefined;
    })();

    // Depois de "Tentar de novo" o foco volta ao campo, que reabre a lista quando a resposta chega.
    const retry = () => {
        search.retry();
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const status = (() => {
        if (applying) {
            return t('catalog.applying');
        }

        if (applyError !== undefined) {
            return applyError === 'notFound'
                ? t('catalog.notFound')
                : t('catalog.applyFailed');
        }

        if (failed) {
            return (
                <span className="flex flex-wrap items-center gap-2">
                    {t('catalog.error')}
                    <Button variant="quiet" onPress={retry}>
                        {t('catalog.retry')}
                    </Button>
                </span>
            );
        }

        return search.status === 'ready' && search.hasMore
            ? t('catalog.more')
            : undefined;
    })();

    return (
        <SearchSelect
            label={t('catalog.label')}
            placeholder={t('catalog.placeholder')}
            items={items}
            inputValue={term}
            onInputChange={(value) => {
                setTerm(value);
                setApplyError(undefined);
                setDismissed(false);
            }}
            onSelect={(id) => void choose(id)}
            inputRef={inputRef}
            loading={search.status === 'loading'}
            // Com erro a lista fecha: a mensagem e o botão ficam na linha de estado, visível.
            openWhenEmpty={searching && !failed && !dismissed}
            emptyMessage={dismissed ? undefined : emptyMessage}
            status={status}
            disabled={disabled}
            disabledReason={disabledReason}
            className={className}
        />
    );
}
