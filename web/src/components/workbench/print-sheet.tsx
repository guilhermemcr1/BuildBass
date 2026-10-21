import { useTranslation } from 'react-i18next';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { displayName } from '@/lib/project/names';
import { useWorkspace } from '@/stores/workspace';
import { CutDrawings } from './cut-drawings';
import { PartsTable } from './parts-table';
import { PlanDimensions } from './plan-dimensions';
import { PlanWarnings } from './plan-warnings';
import { VolumeCheck } from './volume-check';

// Cores de papel: preto sobre branco, qualquer que seja o tema da tela.
const PAPER =
    'print:[--accent-soft:#ddd] print:[--background:#fff] print:[--border:#999] print:[--foreground:#000] print:[--muted:#444] print:[--raised:#fff] print:[--status-error:#a00] print:[--status-ok:#060] print:[--status-warn:#850] print:[--surface:#fff]';

// Folha do plano para imprimir (specs/005, FR-013): fica na página, oculta na tela, e é a única
// coisa visível ao imprimir a visão Plano. Sem a vista 3D e sem controles.
export function PrintSheet() {
    const { t } = useTranslation(['cutplan', 'project']);
    const cutPlan = useCutPlan();
    const project = useWorkspace((state) =>
        state.projects.find((p) => p.id === state.activeId),
    );

    if (cutPlan.status !== 'ready' || project === undefined) {
        return null;
    }

    const { plan } = cutPlan;
    const name = displayName(project, t);

    return (
        <section
            data-print-sheet
            aria-hidden="true"
            className={`hidden flex-col gap-4 bg-white p-6 text-black print:flex ${PAPER}`}
        >
            <h1 className="text-xl font-bold">
                {t('cutplan:print.title', { name })}
            </h1>
            <PlanDimensions plan={plan} />
            <PartsTable plan={plan} name={name} />
            {plan.volume.chambers.length > 0 && (
                <VolumeCheck volume={plan.volume} />
            )}
            <PlanWarnings plan={plan} />
            <CutDrawings plan={plan} />
        </section>
    );
}

export default PrintSheet;
