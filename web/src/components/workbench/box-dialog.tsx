import { Suspense, lazy } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Dialog } from '@/components/ui/dialog';
import { ParameterField } from '@/components/ui/parameter-field';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { planKeySymbol } from '@/lib/cut-plan-text';
import { BoxFields } from './box-fields';
import { PlanWarnings } from './plan-warnings';
import { useParameterField } from './use-parameter-field';

const Box3dView = lazy(() => import('./box-3d-view'));

type BoxDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

// Modal da caixa: campos à esquerda e, à direita, o molde 3D cotado com o alto-falante na frente.
// Mexer num campo atualiza o projeto ativo e o 3D na hora (é o mesmo estado do painel).
export default function BoxDialog({ open, onOpenChange }: BoxDialogProps) {
    const { t } = useTranslation(['workbench', 'cutplan']);
    const { locale } = useLocale();
    const cutPlan = useCutPlan();
    const cutout = useParameterField('cutout_m');
    const thickness = useParameterField('thickness_m');
    const list = new Intl.ListFormat(locale, {
        style: 'long',
        type: 'conjunction',
    });
    const symbols = (keys: Parameters<typeof planKeySymbol>[0][]) =>
        list.format(keys.map((key) => planKeySymbol(key, t)));

    return (
        <Dialog
            title={t('workbench:boxDialog.title')}
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
        >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="flex min-w-0 flex-col gap-3">
                    <BoxFields />
                    <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1.5 text-xs font-semibold text-muted">
                            {t('workbench:boxDialog.speaker')}
                        </legend>
                        <div className="grid grid-cols-2 items-start gap-2">
                            <ParameterField {...cutout} layout="compact" />
                            <ParameterField {...thickness} layout="compact" />
                        </div>
                    </fieldset>
                </div>
                {/* O desenho fica à vista enquanto os campos rolam. */}
                <div className="flex min-w-0 flex-col gap-3 md:sticky md:top-0 md:self-start">
                    {cutPlan.status === 'blocked' ? (
                        <>
                            {cutPlan.missing.length > 0 && (
                                <Banner tone="info">
                                    {t('workbench:boxDialog.missing', {
                                        missing: symbols(cutPlan.missing),
                                    })}
                                </Banner>
                            )}
                            {cutPlan.invalid.length > 0 && (
                                <Banner tone="warn">
                                    {t('workbench:boxDialog.invalid', {
                                        invalid: symbols(cutPlan.invalid),
                                    })}
                                </Banner>
                            )}
                        </>
                    ) : (
                        <>
                            <Suspense fallback={null}>
                                <Box3dView plan={cutPlan.plan} />
                            </Suspense>
                            <PlanWarnings plan={cutPlan.plan} />
                        </>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
