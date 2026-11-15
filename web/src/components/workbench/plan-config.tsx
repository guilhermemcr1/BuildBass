import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { InfoTip } from '@/components/ui/help-tip';
import { ShowMore } from '@/components/ui/show-more';
import { ParameterField } from '@/components/ui/parameter-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { resolveCutPlan } from '@/cutplan';
import { useActiveProject } from '@/hooks/use-active-project';
import { setCutMode, writeSheetRotate } from '@/lib/project/fields';
import { StockList, StockQuantities } from './stock-list';
import { useParameterField } from './use-parameter-field';

type GroupProps = {
    title: string;
    // Texto do `i` ao lado do título: explica o grupo sem ocupar uma linha.
    help: string;
    children: ReactNode;
};

// Um bloco da configuração: título curto com ajuda e os campos logo abaixo.
function Group({ title, help, children }: GroupProps) {
    const { t } = useTranslation('cutplan');

    return (
        <section aria-label={title} className="flex flex-col gap-2.5 p-3">
            <header className="flex items-center gap-1">
                <h4 className="text-section">{title}</h4>
                <InfoTip
                    content={help}
                    label={t('config.help.info', { topic: title })}
                />
            </header>
            {children}
        </section>
    );
}

// Espessura, proporção, recorte do driver e chapa, em grupos pequenos: o que o plano precisa além
// do projeto. Os avançados (reforços, perda de serra, giro) ficam atrás de "Mostrar mais".
export function PlanConfig() {
    const { t } = useTranslation('cutplan');
    const config = useActiveProject((state) => state.data.cutPlan);
    const apply = useActiveProject((state) => state.apply);
    const resolved = resolveCutPlan(config);
    const thickness = useParameterField('thickness_m');
    const braces = useParameterField('braces_m3');
    const cutout = useParameterField('cutout_m');
    const kerf = useParameterField('kerf_m');
    const sheetStarted = config?.sheet !== undefined;
    // Avançados com valor próprio (reforços, perda de serra diferente da padrão, rotação
    // desligada, corte livre ou quantidade no estoque): o botão recolhido avisa que há algo dentro.
    const advancedFilled = [
        config?.braces_m3 !== undefined,
        config?.sheet?.kerf_m !== undefined,
        config?.sheet?.rotate === false,
        config?.sheet?.cut === 'free',
        config?.sheet?.quantity !== undefined ||
            (config?.sheet?.more ?? []).some(
                ({ quantity }) => quantity !== undefined,
            ),
    ].filter(Boolean).length;
    const cut = config?.sheet?.cut ?? 'guillotine';

    return (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-raised/40">
            <Group
                title={t('config.groups.panel')}
                help={t('config.help.panel')}
            >
                <ParameterField {...thickness} layout="row" />
            </Group>
            <Group
                title={t('config.groups.cutout')}
                help={t('config.help.cutout')}
            >
                <ParameterField {...cutout} layout="row" />
            </Group>
            <Group
                title={t('config.groups.sheet')}
                help={t('config.help.sheet')}
            >
                <StockList />
                <ShowMore id="planAdvanced" filled={advancedFilled}>
                    <ParameterField {...braces} layout="row" />
                    <StockQuantities />
                    <ParameterField {...kerf} layout="row" />
                    <Checkbox
                        selected={
                            resolved.sheet?.rotate ??
                            config?.sheet?.rotate ??
                            true
                        }
                        disabled={!sheetStarted}
                        onChange={(rotate) =>
                            apply((data) => writeSheetRotate(data, rotate))
                        }
                    >
                        {t('sheet.rotate')}
                    </Checkbox>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                            <span className="text-[13px] text-foreground">
                                {t('cut.label')}
                            </span>
                            <InfoTip
                                content={t('cut.help')}
                                label={t('config.help.info', {
                                    topic: t('cut.label'),
                                })}
                            />
                        </div>
                        <SegmentedControl
                            label={t('cut.label')}
                            size="sm"
                            variant="tiles"
                            options={[
                                {
                                    id: 'guillotine',
                                    label: t('cut.guillotine'),
                                    disabled: !sheetStarted,
                                },
                                {
                                    id: 'free',
                                    label: t('cut.free'),
                                    disabled: !sheetStarted,
                                },
                            ]}
                            selected={cut}
                            onChange={(mode) =>
                                apply((data) => setCutMode(data, mode))
                            }
                        />
                    </div>
                </ShowMore>
            </Group>
        </div>
    );
}
