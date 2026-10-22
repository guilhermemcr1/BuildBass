import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SliderField } from '@/components/ui/slider-field';
import { useActiveProject } from '@/hooks/use-active-project';
import { useWorkspace } from '@/stores/workspace';
import type { BoxType } from '@/lib/project/types';
import { BoxShape } from './box-shape';
import { PortFields } from './port-fields';
import { SuggestBox } from './suggest-box';
import { useParameterField } from './use-parameter-field';

// Faixas dos sliders (SI): de caixas pequenas de carro a subwoofers grandes; o campo numérico
// continua aceitando toda a faixa física de PARAMETERS.
const VB_SLIDER = { minSi: 0.001, maxSi: 0.3, scale: 'linear' } as const;
const FB_SLIDER = { minSi: 10, maxSi: 200, scale: 'log' } as const;

// Tipo de caixa e os campos de cada tipo; vale tanto no painel quanto no modal da caixa.
export function BoxFields() {
    const { t } = useTranslation('workbench');
    const boxType = useActiveProject((state) => state.data.box.type);
    // A mensagem da sugestão é do projeto em que foi pedida.
    const activeId = useWorkspace((state) => state.activeId);
    const setBoxType = useActiveProject((state) => state.setBoxType);
    const volume = useParameterField('vb_m3');
    const rear = useParameterField('vr_m3');
    const front = useParameterField('vf_m3');
    const tuning = useParameterField('fb_hz');
    const rearTuning = useParameterField('fb_rear_hz');
    const losses = useParameterField('ql');

    return (
        <>
            <div className="flex flex-col gap-1.5">
                <SegmentedControl<BoxType>
                    label={t('boxType.label')}
                    selected={boxType}
                    onChange={setBoxType}
                    options={[
                        { id: 'closed', label: t('boxType.closed') },
                        { id: 'vented', label: t('boxType.vented') },
                        { id: 'bandpass', label: t('boxType.bandpass') },
                        { id: 'bandpass6', label: t('boxType.bandpass6') },
                    ]}
                    variant="tiles"
                    className="grid w-full grid-cols-2"
                />
            </div>
            <BoxShape />
            <div key={boxType} className="flex swap flex-col gap-3">
                {boxType === 'bandpass6' ? (
                    <>
                        <fieldset className="flex flex-col gap-2.5">
                            <legend className="mb-1.5 text-xs font-semibold text-muted">
                                {t('chambers.rear')}
                            </legend>
                            <SliderField {...rear} {...VB_SLIDER} />
                            <SliderField {...rearTuning} {...FB_SLIDER} />
                            <PortFields duct="rear" />
                        </fieldset>
                        <fieldset className="flex flex-col gap-2.5">
                            <legend className="mb-1.5 text-xs font-semibold text-muted">
                                {t('chambers.front')}
                            </legend>
                            <SliderField {...front} {...VB_SLIDER} />
                            <SliderField {...tuning} {...FB_SLIDER} />
                            <PortFields duct="front" />
                        </fieldset>
                        <SuggestBox
                            key={activeId}
                            title={t('boxGroups.losses')}
                        >
                            <ParameterField {...losses} />
                        </SuggestBox>
                    </>
                ) : (
                    <>
                        <SuggestBox
                            key={activeId}
                            title={
                                boxType === 'closed'
                                    ? t('boxGroups.volume')
                                    : t('boxGroups.tuning')
                            }
                        >
                            {/* Volume, sintonia e perdas lado a lado: cada campo com o símbolo em cima. */}
                            <div
                                className={cn(
                                    'grid items-start gap-2',
                                    boxType === 'vented'
                                        ? 'grid-cols-3'
                                        : 'grid-cols-2',
                                )}
                            >
                                {boxType === 'bandpass' ? (
                                    <>
                                        <SliderField
                                            {...rear}
                                            {...VB_SLIDER}
                                            layout="compact"
                                        />
                                        <SliderField
                                            {...front}
                                            {...VB_SLIDER}
                                            layout="compact"
                                        />
                                    </>
                                ) : (
                                    <SliderField
                                        {...volume}
                                        {...VB_SLIDER}
                                        layout="compact"
                                    />
                                )}
                                {boxType !== 'closed' && (
                                    <SliderField
                                        {...tuning}
                                        {...FB_SLIDER}
                                        layout="compact"
                                    />
                                )}
                                <ParameterField {...losses} layout="compact" />
                            </div>
                        </SuggestBox>
                        {boxType !== 'closed' && <PortFields />}
                    </>
                )}
            </div>
        </>
    );
}
