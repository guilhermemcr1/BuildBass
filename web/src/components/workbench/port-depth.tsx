import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SelectField } from '@/components/ui/select-field';
import type { PortInput } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { simulationOf } from '@/hooks/use-simulation';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';
import { useParameterField } from './use-parameter-field';

type Mode = 'tuning' | 'length';

type Props = {
    port: PortInput;
    rear: boolean;
};

// Profundidade do duto: sai da sintonia (padrão) ou é informada, e aí a sintonia sai dela. A troca
// leva o valor atual de um lado para o outro, então a caixa não muda ao trocar de modo.
export function PortDepthField({ port, rear }: Props) {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const apply = useActiveProject((state) => state.apply);
    const results = useActiveProject(
        (state) => simulationOf(state.data).results,
    );
    const field = useParameterField(
        rear ? 'rear_port_length_m' : 'port_length_m',
    );
    const unitSystem = usePreferences((state) => state.unitSystem);
    const mode: Mode = port.length_m === undefined ? 'tuning' : 'length';
    const computed = rear ? results.port_rear_length_m : results.port_length_m;
    const tuning = rear ? results.fb_rear_hz : results.fb_hz;
    const portKey = rear ? 'port_rear' : 'port';
    const fbKey = rear ? 'fb_rear_hz' : 'fb_hz';

    const changeMode = (next: Mode) =>
        apply((data) => {
            const current = (rear ? data.box.port_rear : data.box.port) ?? port;
            const { length_m: _length, ...rest } = current;

            if (next === 'length') {
                // Começa com o comprimento que a sintonia atual dá (arredondado ao milímetro).
                const start =
                    computed !== undefined && computed > 0
                        ? Math.round(computed * 1000) / 1000
                        : 0.3;

                return {
                    ...data,
                    box: {
                        ...data.box,
                        [portKey]: { ...rest, length_m: start },
                    },
                };
            }

            // Volta à sintonia: a Fb que a profundidade dava passa a ser a gravada.
            return {
                ...data,
                box: {
                    ...data.box,
                    [portKey]: rest,
                    ...(tuning === undefined ? {} : { [fbKey]: tuning }),
                },
            };
        });

    return (
        <div className="grid grid-cols-2 items-end gap-x-3 gap-y-1">
            <SelectField<Mode>
                label={t('port.depth')}
                selected={mode}
                onChange={changeMode}
                options={[
                    { id: 'tuning', label: t('port.depth_tuning') },
                    { id: 'length', label: t('port.depth_length') },
                ]}
            />
            {mode === 'length' ? (
                <ParameterField {...field} layout="stacked" />
            ) : (
                <p className="pb-2 num text-sm text-foreground">
                    {computed !== undefined && computed > 0
                        ? formatWithUnit(
                              computed,
                              defaultUnitFor('length', unitSystem),
                              locale,
                          )
                        : '—'}
                </p>
            )}
        </div>
    );
}
