import { useTranslation } from 'react-i18next';
import { SelectField } from '@/components/ui/select-field';
import { useActiveProject } from '@/hooks/use-active-project';
import type { BoxFill } from '@/lib/project/types';

// Valores de QL com nome: 7 é o padrão do Hornresp e das tabelas de alinhamento, 10 o do WinISD.
const QL_PRESETS = ['5', '7', '10', '15'] as const;

type Preset = (typeof QL_PRESETS)[number] | 'custom';

const FILLS: BoxFill[] = ['none', 'lined', 'stuffed'];

// Perdas da caixa em linguagem de uso: QL por situação (o número segue editável no campo Ql) e o
// material de absorção, que vira o QA do motor.
export function LossFields() {
    const { t } = useTranslation('workbench');
    const ql = useActiveProject((state) => state.data.box.ql);
    const fill = useActiveProject((state) => state.data.box.fill ?? 'none');
    const setBoxValue = useActiveProject((state) => state.setBoxValue);
    const setBoxFill = useActiveProject((state) => state.setBoxFill);
    const preset: Preset =
        QL_PRESETS.find((value) => Number(value) === ql) ?? 'custom';

    return (
        <div className="grid grid-cols-2 items-start gap-2">
            <SelectField<Preset>
                label={t('losses.preset')}
                selected={preset}
                onChange={(id) => {
                    if (id !== 'custom') {
                        setBoxValue('ql', Number(id));
                    }
                }}
                options={[
                    ...QL_PRESETS.map((value) => ({
                        id: value,
                        label: t(`losses.ql${value}`),
                    })),
                    { id: 'custom' as const, label: t('losses.custom') },
                ]}
            />
            <SelectField<BoxFill>
                label={t('losses.fill')}
                selected={fill}
                onChange={setBoxFill}
                options={FILLS.map((id) => ({
                    id,
                    label: t(`losses.fill_${id}`),
                }))}
            />
        </div>
    );
}
