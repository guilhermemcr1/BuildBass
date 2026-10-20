import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ParameterField } from '@/components/ui/parameter-field';
import { SearchSelect } from '@/components/ui/search-select';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { DRIVER_PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { Panel } from './panel';
import { useParameterField } from './use-parameter-field';

function DriverField({ parameter }: { parameter: ParameterKey }) {
    return <ParameterField {...useParameterField(parameter)} />;
}

type DriverPanelProps = {
    onSubmitDriver: () => void;
};

export function DriverPanel({ onSubmitDriver }: DriverPanelProps) {
    const { t } = useTranslation('workbench');
    const offline = useOnlineStatus() === 'offline';
    const offlineReason = t('catalog.offlineReason');

    // Catálogo e envio dependem do servidor (constituição, Princípio V); a busca e o envio de
    // fato chegam em features próprias.
    const submit = (
        <Button
            variant="secondary"
            disabled={offline}
            onPress={onSubmitDriver}
            aria-description={offline ? offlineReason : undefined}
            className="shrink-0"
        >
            <Send aria-hidden="true" className="size-4" />
            {t('catalog.submit')}
        </Button>
    );

    return (
        <Panel region="driver" title={t('regions.driver')}>
            <div className="flex flex-wrap items-end gap-2">
                <SearchSelect
                    label={t('catalog.label')}
                    placeholder={t('catalog.placeholder')}
                    items={[]}
                    onSelect={() => undefined}
                    disabled={offline}
                    disabledReason={offlineReason}
                    className="min-w-48 flex-1"
                />
                {submit}
            </div>
            <div className="grid grid-cols-2 items-start gap-2">
                {DRIVER_PARAMETERS.map((key) => (
                    <DriverField key={key} parameter={key} />
                ))}
            </div>
        </Panel>
    );
}
