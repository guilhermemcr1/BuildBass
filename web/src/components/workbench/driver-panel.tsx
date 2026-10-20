import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { DRIVER_PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { Panel } from './panel';
import { useParameterField } from './use-parameter-field';

function DriverField({ parameter }: { parameter: ParameterKey }) {
    return <ParameterField {...useParameterField(parameter)} />;
}

export function DriverPanel() {
    const { t } = useTranslation('workbench');

    return (
        <Panel region="driver" title={t('regions.driver')}>
            <div className="grid grid-cols-2 items-start gap-2">
                {DRIVER_PARAMETERS.map((key) => (
                    <DriverField key={key} parameter={key} />
                ))}
            </div>
        </Panel>
    );
}
