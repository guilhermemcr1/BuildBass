import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { signalLevels } from '@/engine';
import type { Radiation, SignalInput } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { useActiveSimulation } from '@/hooks/use-simulation';
import { formatWithUnit } from '@/lib/units/format';
import { useParameterField } from './use-parameter-field';

type Mode = SignalInput['mode'];

// Sinal em W ou V (o outro aparece calculado) e radiação.
export function SignalFields() {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const data = useActiveProject((state) => state.data);
    const setSignal = useActiveProject((state) => state.setSignal);
    const { warnings } = useActiveSimulation();
    const power = useParameterField('power_w');
    const voltage = useParameterField('voltage_v');
    const { mode, radiation } = data.signal;
    const levels = signalLevels(data);
    const thermal = warnings.find(({ id }) => id === 'aboveThermalPower');

    // Ao trocar o modo, o campo novo recebe o valor equivalente (sem Re, fica o que já havia).
    const switchMode = (next: Mode) => {
        if (next === mode) {
            return;
        }

        setSignal(
            next === 'voltage'
                ? {
                      mode: next,
                      voltage_v: levels.voltage_v ?? data.signal.voltage_v,
                  }
                : {
                      mode: next,
                      power_w: levels.power_w ?? data.signal.power_w,
                  },
        );
    };

    const other =
        mode === 'power'
            ? levels.voltage_v === undefined
                ? undefined
                : formatWithUnit(levels.voltage_v, 'V', locale)
            : levels.power_w === undefined
              ? undefined
              : formatWithUnit(levels.power_w, 'W', locale);

    return (
        <fieldset className="grid grid-cols-2 items-start gap-x-3 gap-y-2">
            <legend className="mb-1.5 text-xs font-semibold text-muted">
                {t('signal.title')}
            </legend>
            <SegmentedControl<Mode>
                label={t('signal.mode')}
                selected={mode}
                onChange={switchMode}
                options={[
                    { id: 'power', label: t('signal.power') },
                    { id: 'voltage', label: t('signal.voltage') },
                ]}
                size="sm"
                className="w-full"
            />
            <ParameterField
                {...(mode === 'power' ? power : voltage)}
                status={thermal === undefined ? 'none' : 'warn'}
                statusMessage={
                    [
                        other === undefined || levels.re_total_ohm === undefined
                            ? undefined
                            : t('signal.equivalent', {
                                  value: other,
                                  re: formatWithUnit(
                                      levels.re_total_ohm,
                                      'ohm',
                                      locale,
                                  ),
                              }),
                        thermal?.values?.limit_w === undefined
                            ? undefined
                            : t('signal.abovePe', {
                                  limit: formatWithUnit(
                                      thermal.values.limit_w,
                                      'W',
                                      locale,
                                  ),
                              }),
                    ]
                        .filter((text) => text !== undefined)
                        .join(' ') || undefined
                }
            />
            <SegmentedControl<Radiation>
                label={t('signal.radiation')}
                selected={radiation}
                onChange={(next) => setSignal({ radiation: next })}
                options={[
                    { id: 'half', label: t('signal.half') },
                    { id: 'full', label: t('signal.full') },
                ]}
                size="sm"
                className="col-span-2 w-full"
            />
        </fieldset>
    );
}
