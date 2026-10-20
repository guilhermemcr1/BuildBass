import { useTranslation } from 'react-i18next';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { ParameterKey } from '@/lib/parameters';
import { useDraft } from '@/stores/draft';
import type { BoxType } from '@/stores/draft';
import { Panel } from './panel';
import { useParameterField } from './use-parameter-field';

function BoxField({ parameter }: { parameter: ParameterKey }) {
    const { onUnitChange: _onUnitChange, ...field } =
        useParameterField(parameter);

    return <ParameterField {...field} />;
}

export function BoxPanel() {
    const { t } = useTranslation('workbench');
    const boxType = useDraft((state) => state.boxType);
    const setBoxType = useDraft((state) => state.setBoxType);

    return (
        <Panel region="box" title={t('regions.box')}>
            <div className="flex flex-col gap-1.5">
                <SegmentedControl<BoxType | 'bandpass'>
                    label={t('boxType.label')}
                    selected={boxType}
                    onChange={(next) => {
                        if (next !== 'bandpass') {
                            setBoxType(next);
                        }
                    }}
                    options={[
                        { id: 'closed', label: t('boxType.closed') },
                        { id: 'vented', label: t('boxType.vented') },
                        {
                            id: 'bandpass',
                            label: t('boxType.bandpass'),
                            disabled: true,
                        },
                    ]}
                    className="w-full"
                />
                <p className="text-[11px] text-muted">
                    {t('boxType.bandpassUnavailable')}
                </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <BoxField parameter="vb_m3" />
                {boxType === 'vented' && <BoxField parameter="fb_hz" />}
            </div>
        </Panel>
    );
}
