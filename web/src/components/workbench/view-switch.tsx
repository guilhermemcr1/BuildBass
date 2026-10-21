import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/segmented-control';

export type WorkbenchView = 'charts' | 'plan';

type ViewSwitchProps = {
    selected: WorkbenchView;
    onChange: (view: WorkbenchView) => void;
};

// Alterna a coluna da direita entre os gráficos e o plano de corte (estado de tela, não do projeto).
export function ViewSwitch({ selected, onChange }: ViewSwitchProps) {
    const { t } = useTranslation('workbench');

    return (
        <SegmentedControl<WorkbenchView>
            label={t('view.label')}
            selected={selected}
            onChange={onChange}
            options={[
                { id: 'charts', label: t('view.charts') },
                { id: 'plan', label: t('view.plan') },
            ]}
            className="mb-3 w-full"
        />
    );
}
