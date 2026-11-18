import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { Wiring } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { IMPEDANCE_SYMBOL, coilLoad, parseVariant } from '@/lib/impedance';
import { DvcBadge } from './dvc-badge';
import { useParameterField } from './use-parameter-field';

// Quantidade de drivers iguais na caixa e como são ligados. Driver de bobina dupla ("4+4 Ω") ganha
// a ligação das bobinas, e a carga final no amplificador junta as duas ligações.
export function DriversFields() {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const wiring = useActiveProject((state) => state.data.drivers.wiring);
    const coilWiring = useActiveProject(
        (state) => state.data.drivers.coil_wiring ?? 'series',
    );
    const driverCount = useActiveProject((state) => state.data.drivers.count);
    const variantText = useActiveProject(
        (state) => state.data.driverSource?.variant,
    );
    const setDrivers = useActiveProject((state) => state.setDrivers);
    const count = useParameterField('driver_count');
    const variant =
        variantText === undefined ? null : parseVariant(variantText);
    const dvc = variant?.coils === 2;
    const ohms = (value: number) =>
        `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${IMPEDANCE_SYMBOL}`;
    // Carga nominal por driver (com as bobinas ligadas) e do conjunto todo.
    const perDriver =
        variant === null ? undefined : coilLoad(variant, coilWiring);
    const units = Math.max(1, Math.round(driverCount));
    const total =
        perDriver === undefined
            ? undefined
            : wiring === 'series'
              ? perDriver * units
              : perDriver / units;

    return (
        <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted">
                {t('drivers.title')}
                {dvc && <DvcBadge />}
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
            {dvc && variant !== null && (
                <div className="flex flex-col gap-1">
                    <span
                        aria-hidden="true"
                        className="text-[11px] leading-4 font-semibold text-muted"
                    >
                        {t('drivers.coils', { variant: variantText })}
                    </span>
                    <SegmentedControl<Wiring>
                        label={t('drivers.coilsLabel', {
                            variant: variantText,
                        })}
                        selected={coilWiring}
                        onChange={(next) => setDrivers({ coil_wiring: next })}
                        options={[
                            {
                                id: 'series',
                                label: `${t('drivers.series')} · ${ohms(coilLoad(variant, 'series'))}`,
                            },
                            {
                                id: 'parallel',
                                label: `${t('drivers.parallel')} · ${ohms(coilLoad(variant, 'parallel'))}`,
                            },
                        ]}
                        size="sm"
                        className="w-full"
                    />
                </div>
            )}
            {total !== undefined && (
                <p className="text-[11px] text-muted">
                    {t('drivers.load')}{' '}
                    <span className="font-semibold text-foreground tabular-nums">
                        {ohms(total)}
                    </span>
                </p>
            )}
        </fieldset>
    );
}
