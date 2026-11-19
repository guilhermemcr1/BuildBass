import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { PortInput } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { simulationOf } from '@/hooks/use-simulation';
import { useParameterField } from './use-parameter-field';

type Mode = 'tuning' | 'length';

type Props = {
    port: PortInput;
    rear: boolean;
};

// Profundidade do duto e a trava: com a trava na Fb (padrão) o comprimento sai da sintonia; com a
// trava no comprimento a Fb sai dele. Os dois campos são editáveis: editar um trava nele. Trocar a
// trava leva o valor atual de um lado para o outro, então a caixa não muda.
export function PortDepthField({ port, rear }: Props) {
    const { t } = useTranslation('workbench');
    const apply = useActiveProject((state) => state.apply);
    const results = useActiveProject(
        (state) => simulationOf(state.data).results,
    );
    const field = useParameterField(
        rear ? 'rear_port_length_m' : 'port_length_m',
    );
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

    // O campo vale nos dois modos: travado no comprimento, mostra o informado; travado na Fb, mostra
    // o que a sintonia dá, e digitar um comprimento passa a trava para ele.
    const lengthField = {
        ...field,
        valueSi: mode === 'length' ? field.valueSi : computed,
        calculatedLabel:
            mode === 'tuning' ? t('port.lengthFromTuning') : undefined,
        onChangeSi: (si: number | undefined) =>
            apply((data) => {
                const current = data.box[portKey] ?? port;

                if (si === undefined) {
                    return data;
                }

                return {
                    ...data,
                    box: {
                        ...data.box,
                        [portKey]: { ...current, length_m: si },
                    },
                };
            }),
    };

    return (
        <div className="grid grid-cols-2 items-start gap-x-3 gap-y-1">
            <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-muted">
                    {t('port.lock')}
                </span>
                <SegmentedControl<Mode>
                    label={t('port.lock')}
                    size="sm"
                    className="flex w-full"
                    selected={mode}
                    onChange={changeMode}
                    options={[
                        {
                            id: 'tuning',
                            label: t('port.lockTuning'),
                            short: 'Fb',
                        },
                        {
                            id: 'length',
                            label: t('port.lockLength'),
                            short: t('port.lockLengthShort'),
                        },
                    ]}
                />
            </div>
            <ParameterField {...lengthField} layout="stacked" />
        </div>
    );
}
