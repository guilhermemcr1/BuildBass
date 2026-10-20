import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SliderField } from '@/components/ui/slider-field';
import { useDraft } from '@/stores/draft';
import type { BoxType } from '@/stores/draft';
import { Panel } from './panel';
import { useParameterField } from './use-parameter-field';

// Faixas dos sliders (SI): de caixas pequenas de carro a subwoofers grandes; o campo numérico
// continua aceitando toda a faixa física de PARAMETERS.
const VB_SLIDER = { minSi: 0.001, maxSi: 0.3, scale: 'linear' } as const;
const FB_SLIDER = { minSi: 10, maxSi: 200, scale: 'log' } as const;

export function BoxPanel() {
    const { t } = useTranslation('workbench');
    const boxType = useDraft((state) => state.boxType);
    const setBoxType = useDraft((state) => state.setBoxType);
    const volume = useParameterField('vb_m3');
    const tuning = useParameterField('fb_hz');

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
            <div className="flex flex-col gap-3">
                <SliderField {...volume} {...VB_SLIDER} />
                {boxType === 'vented' && (
                    <SliderField {...tuning} {...FB_SLIDER} />
                )}
            </div>
        </Panel>
    );
}
