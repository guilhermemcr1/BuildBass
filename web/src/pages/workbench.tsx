import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoxPanel } from '@/components/workbench/box-panel';
import { CHART_KINDS, ChartPanel } from '@/components/workbench/chart-panel';
import type { ChartKind } from '@/components/workbench/chart-panel';
import { ComingSoonDialog } from '@/components/workbench/coming-soon-dialog';
import { DriverPanel } from '@/components/workbench/driver-panel';
import { OfflineBanner } from '@/components/workbench/offline-banner';
import { PreferencesBar } from '@/components/workbench/preferences-bar';
import { ResultsPanel } from '@/components/workbench/results-panel';
import { ShortcutsDialog } from '@/components/workbench/shortcuts-dialog';
import { TopBar } from '@/components/workbench/top-bar';
import type { ProjectAction } from '@/components/workbench/top-bar';
import { useShortcuts } from '@/hooks/use-shortcuts';

// Layout da bancada (FR-007): ≥ 1280 px três colunas (driver | caixa + resultados | gráficos),
// 768–1279 px duas colunas com gráficos e resultados em largura total, < 768 px uma coluna na
// ordem do DOM: driver → caixa → gráficos → resultados.
export default function Workbench() {
    const { t } = useTranslation('workbench');
    const [pending, setPending] = useState<string | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [chart, setChart] = useState<ChartKind>('response');

    // Ações sem implementação ainda abrem o aviso "disponível em breve" (FR-021).
    useShortcuts(({ id, key }) => {
        if (id === 'chartTabs') {
            setChart(CHART_KINDS[Number(key) - 1] ?? chart);
        } else if (id === 'help') {
            setHelpOpen(true);
        } else {
            setPending(t(`actions.${id}`));
        }
    });

    return (
        <div className="flex min-h-dvh flex-col">
            <TopBar
                onAction={(action: ProjectAction) =>
                    setPending(t(`actions.${action}`))
                }
                onHelp={() => setHelpOpen(true)}
                preferences={<PreferencesBar />}
            />
            <OfflineBanner />
            <main className="grid flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-[minmax(300px,360px)_minmax(260px,320px)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
                <DriverPanel
                    onSubmitDriver={() => setPending(t('catalog.submit'))}
                />
                <BoxPanel />
                <div className="md:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:flex xl:flex-col [&>section]:flex-1">
                    <ChartPanel selected={chart} onSelectedChange={setChart} />
                </div>
                <div className="md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-2">
                    <ResultsPanel />
                </div>
            </main>
            <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
            <ComingSoonDialog
                action={pending}
                onClose={() => setPending(null)}
            />
        </div>
    );
}
