import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCutPlan } from '@/hooks/use-cut-plan';
import { useSheetLayout } from '@/hooks/use-sheet-layout';
import { displayName } from '@/lib/project/names';
import { useWorkspace } from '@/stores/workspace';
import { CutDrawings } from './cut-drawings';
import { CutTotals } from './cut-totals';
import { PartsTable } from './parts-table';
import { PlanDimensions } from './plan-dimensions';
import { PlanWarnings } from './plan-warnings';
import { PrintHeader } from './print-header';
import { SheetLayout } from './sheet-layout';
import { VolumeCheck } from './volume-check';

// Cores de papel: preto sobre branco, qualquer que seja o tema da tela.
const PAPER =
    'print:[--accent-soft:#ddd] print:[--background:#fff] print:[--border:#999] print:[--foreground:#000] print:[--muted:#444] print:[--raised:#fff] print:[--status-error:#a00] print:[--status-ok:#060] print:[--status-warn:#850] print:[--surface:#fff]';

// Folha do plano para imprimir: fica na página, oculta na tela, e é a única
// coisa visível ao imprimir a visão Plano. Sem a vista 3D e sem controles.
type PrintSheetProps = {
    // Chamado depois que a folha está na página; a bancada abre a impressão a partir dele.
    onReady?: () => void;
};

export function PrintSheet({ onReady }: PrintSheetProps) {
    const { t } = useTranslation(['cutplan', 'project']);
    const cutPlan = useCutPlan();
    const suggestion = useSheetLayout(
        cutPlan.status === 'ready' ? cutPlan.plan : undefined,
    );
    const project = useWorkspace((state) =>
        state.projects.find((p) => p.id === state.activeId),
    );

    const ready = cutPlan.status === 'ready' && project !== undefined;

    useEffect(() => {
        if (!ready) {
            return;
        }

        // Um quadro depois da montagem, para o layout da folha estar pronto.
        const frame = requestAnimationFrame(() => onReady?.());

        return () => cancelAnimationFrame(frame);
    }, [ready]);

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
            <PrintHeader name={name} />
            <PlanDimensions plan={plan} />
            <CutTotals plan={plan} />
            <PartsTable plan={plan} name={name} />
            {plan.volume.chambers.length > 0 && (
                <VolumeCheck volume={plan.volume} />
            )}
            <PlanWarnings plan={plan} />
            <CutDrawings plan={plan} editable={false} />
            {suggestion !== undefined && (
                <SheetLayout
                    layout={suggestion.layout}
                    sheet={suggestion.sheet}
                />
            )}
        </section>
    );
}

export default PrintSheet;
