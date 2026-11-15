import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { Wiring } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useParameterField } from './use-parameter-field';

// Quantidade de drivers iguais na caixa e como são ligados (research.md §5).
export function DriversFields() {
    const { t } = useTranslation('workbench');
    const wiring = useActiveProject((state) => state.data.drivers.wiring);
    const setDrivers = useActiveProject((state) => state.setDrivers);
    const count = useParameterField('driver_count');

    return (
        <fieldset className="flex flex-col">
            <legend className="mb-1.5 text-xs font-semibold text-muted">
                {t('drivers.title')}
            </legend>
            <div className="grid grid-cols-2 items-start gap-x-3 gap-y-2">
                {/* Nome por extenso no lugar do "N", que não diz o que é; a ligação ganha o rótulo
                    visível para os dois campos ficarem alinhados. */}
                <ParameterField {...count} layout="stacked" />
                <div className="flex flex-col gap-1">
                    <span
                        aria-hidden="true"
                        className="truncate text-[11px] leading-4 font-semibold text-muted"
                    >
                        {t('drivers.wiringShort')}
                    </span>
                    <SegmentedControl<Wiring>
                        label={t('drivers.wiring')}
                        selected={wiring}
                        onChange={(next) => setDrivers({ wiring: next })}
                        options={[
                            { id: 'parallel', label: t('drivers.parallel') },
                            { id: 'series', label: t('drivers.series') },
                        ]}
                        size="sm"
                        className="w-full"
                    />
                </div>
            </div>
        </fieldset>
    );
}
