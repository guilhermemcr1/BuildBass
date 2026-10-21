import { useState } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { SearchSelect } from '@/components/ui/search-select';
import type { SearchOption } from '@/components/ui/search-select';
import { activeProjectStore } from '@/hooks/use-active-project';
import { SEARCH_MIN_LENGTH, useDriverSearch } from '@/hooks/use-driver-search';
import { fetchDriver } from '@/lib/catalog/client';
import { toDriverInput } from '@/lib/catalog/to-driver-input';
import type { DriverSummary } from '@/lib/catalog/types';
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

    const items: SearchOption[] = search.items.map((driver) => ({
        id: String(driver.id),
        label: displayName(driver),
        description: support(driver),
    }));

    const searching = !disabled && term.trim().length >= SEARCH_MIN_LENGTH;

    const choose = async (id: string) => {
        const result = await fetchDriver(Number(id));

        if (!result.ok) {
            return;
        }

        const { driver, source } = toDriverInput(result.data.data);
        activeProjectStore().getState().applyCatalogDriver(driver, source);
        setTerm('');
    };

    return (
        <SearchSelect
            label={t('catalog.label')}
            placeholder={t('catalog.placeholder')}
            items={items}
            inputValue={term}
            onInputChange={setTerm}
            onSelect={(id) => void choose(id)}
            loading={search.status === 'loading'}
            openWhenEmpty={searching}
            emptyMessage={
                search.status === 'loading' ? t('catalog.searching') : undefined
            }
            disabled={disabled}
            disabledReason={disabledReason}
            className={className}
        />
    );
}
