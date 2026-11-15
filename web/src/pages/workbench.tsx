import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoxPanel } from '@/components/workbench/box-panel';
import { CHART_KINDS, ChartPanel } from '@/components/workbench/chart-panel';
import type { ChartKind } from '@/components/workbench/chart-panel';
import { Banner } from '@/components/ui/banner';
import { CloseProjectDialog } from '@/components/workbench/close-project-dialog';
import { DriverPanel } from '@/components/workbench/driver-panel';
import { FileDrop } from '@/components/workbench/file-drop';
import { OpenErrorDialog } from '@/components/workbench/open-error-dialog';
import type { OpenError } from '@/components/workbench/open-error-dialog';
import { OfflineBanner } from '@/components/workbench/offline-banner';
import { PreferencesBar } from '@/components/workbench/preferences-bar';
import { ProjectName } from '@/components/workbench/project-name';
import { ProjectTabs } from '@/components/workbench/project-tabs';
import { ResultsPanel } from '@/components/workbench/results-panel';
import { ShortcutsDialog } from '@/components/workbench/shortcuts-dialog';
import { TabLimitDialog } from '@/components/workbench/tab-limit-dialog';
import { TopBar } from '@/components/workbench/top-bar';
import type { ProjectAction } from '@/components/workbench/top-bar';
import {
    activeProjectStore,
    useActiveHistory,
} from '@/hooks/use-active-project';
import { useShortcuts } from '@/hooks/use-shortcuts';
import { downloadProject, parseProjectFile } from '@/lib/project/file';
import { displayName } from '@/lib/project/names';
import {
    MAX_OPEN_PROJECTS,
    projectStore,
    useWorkspace,
} from '@/stores/workspace';

const SubmitDriverDialog = lazy(
    () => import('@/components/workbench/submit-driver-dialog'),
);

const Tutorial = lazy(() => import('@/components/tutorial/tutorial'));

const PrintSheet = lazy(() => import('@/components/workbench/print-sheet'));

const PlanPanel = lazy(() =>
    import('@/components/workbench/plan-panel').then((module) => ({
        default: module.PlanPanel,
    })),
);

// Layout da bancada (FR-007): ≥ 1280 px lateral fixa (abas, driver, caixa) e, à direita, resultados
// numa faixa acima do gráfico; 768–1279 px driver e caixa lado a lado com resultados e gráficos em
// largura total; < 768 px uma coluna na ordem do DOM: driver → caixa → resultados → gráficos.
export default function Workbench() {
    const { t } = useTranslation(['workbench', 'project']);
    const [submitting, setSubmitting] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [tutorialOpen, setTutorialOpen] = useState(false);
    const [limitOpen, setLimitOpen] = useState(false);
    const [openError, setOpenError] = useState<OpenError | null>(null);
    const [closing, setClosing] = useState<string | null>(null);
    const projectCount = useWorkspace((state) => state.projects.length);
    const storageAvailable = useWorkspace((state) => state.storageAvailable);
    const closingProject = useWorkspace((state) =>
        state.projects.find((p) => p.id === closing),
    );
    const [chart, setChart] = useState<ChartKind>('response');
    const [planOpen, setPlanOpen] = useState(false);
    // Imprimir o plano monta a folha, esconde a bancada e só então abre a impressão; `afterprint`
    // (imprimiu ou cancelou) desfaz tudo.
    const [printing, setPrinting] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const history = useActiveHistory();

    useEffect(() => {
        if (!printing) {
            return;
        }

        const done = () => setPrinting(false);

        window.addEventListener('afterprint', done);

        return () => window.removeEventListener('afterprint', done);
    }, [printing]);

    const openFile = async (file: File) => {
        const result = await parseProjectFile(file);

        if (!result.ok) {
            setOpenError({ code: result.code, path: result.path });
        } else if (
            useWorkspace.getState().openProject(result.data, result.color) ===
            'limit'
        ) {
            setLimitOpen(true);
        }
    };

    // Projeto com alterações não exportadas pede confirmação antes de fechar (FR-021c).
    const requestClose = (id: string) => {
        const project = useWorkspace
            .getState()
            .projects.find((p) => p.id === id);

        if (project?.unsaved === true) {
            setClosing(id);
        } else {
            useWorkspace.getState().closeProject(id);
        }
    };

    const runAction = (action: ProjectAction | 'undo' | 'redo') => {
        const workspace = useWorkspace.getState();

        switch (action) {
            case 'new':
                if (workspace.newProject() === 'limit') {
                    setLimitOpen(true);
                }
                break;
            case 'open':
                // Com 3 abertos o arquivo não teria onde abrir: avisa antes de escolher.
                if (workspace.projects.length >= MAX_OPEN_PROJECTS) {
                    setLimitOpen(true);
                } else {
                    fileInput.current?.click();
                }
                break;
            case 'export':
                downloadProject(
                    activeProjectStore().getState().data,
                    workspace.projects.find((p) => p.id === workspace.activeId)
                        ?.color,
                );
                workspace.markExported(workspace.activeId);
                break;
            case 'undo':
                history.undo();
                break;
            case 'redo':
                history.redo();
                break;
        }
    };

    useShortcuts(({ id, key }) => {
        if (id === 'chartTabs') {
            setChart(CHART_KINDS[Number(key) - 1] ?? chart);
        } else if (id === 'help') {
            setHelpOpen(true);
        } else {
            runAction(id);
        }
    });

    return (
        <div className="flex min-h-dvh flex-col xl:h-dvh">
            {/* Ao imprimir o plano, só a folha do plano sai; a bancada some (specs/005, FR-013). */}
            <div className={printing ? 'contents print:hidden' : 'contents'}>
                <TopBar
                    onAction={runAction}
                    history={history}
                    projectName={<ProjectName />}
                    onHelp={() => setHelpOpen(true)}
                    onTutorial={() => setTutorialOpen(true)}
                    preferences={<PreferencesBar />}
                />
                <OfflineBanner />
                {!storageAvailable && (
                    <Banner tone="warn" className="mx-3 mt-3">
                        {t('project:storage.unavailable')}
                    </Banner>
                )}
                <main className="grid flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:min-h-0 xl:grid-cols-[23rem_minmax(0,1fr)] xl:gap-0 xl:p-0">
                    {/* Em ≥ 1280 px uma lateral fixa (abas, driver e caixa) com rolagem própria; abaixo
                        disso o wrapper some e cada bloco vira item da grade. */}
                    <div className="contents xl:relative xl:flex xl:min-h-0 xl:[scrollbar-gutter:stable] xl:flex-col xl:overflow-y-auto xl:border-r xl:border-border xl:bg-surface">
                        <div
                            data-tour="tabs"
                            className="md:col-span-2 xl:col-span-1 xl:px-3 xl:py-2.5"
                        >
                            <ProjectTabs onClose={requestClose} />
                        </div>
                        <DriverPanel
                            onSubmitDriver={() => setSubmitting(true)}
                        />
                        <BoxPanel />
                    </div>
                    {/* Resultados numa faixa acima do gráfico, que ocupa o resto da altura. */}
                    <div className="contents xl:relative xl:flex xl:min-h-0 xl:[scrollbar-gutter:stable] xl:flex-col xl:gap-3 xl:overflow-y-auto xl:p-3">
                        <div className="rise md:col-span-2">
                            <ResultsPanel />
                        </div>
                        <div className="flex rise flex-col [--rise-delay:60ms] md:col-span-2 xl:min-h-[28rem] xl:flex-1 [&>section]:flex-1">
                            <ChartPanel
                                selected={chart}
                                onSelectedChange={setChart}
                            />
                        </div>
                        {/* O plano de corte vem depois dos gráficos, recolhido até alguém abrir. */}
                        <div className="md:col-span-2 xl:shrink-0">
                            <Suspense
                                fallback={
                                    <div
                                        className="h-16 rounded-lg border border-border bg-surface"
                                        aria-hidden="true"
                                    />
                                }
                            >
                                <PlanPanel
                                    open={planOpen}
                                    onOpenChange={setPlanOpen}
                                    onPrint={() => setPrinting(true)}
                                />
                            </Suspense>
                        </div>
                    </div>
                </main>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".json,.buildbass.json,application/json"
                    hidden
                    data-testid="open-file"
                    onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        // Limpar permite abrir o mesmo arquivo de novo.
                        event.currentTarget.value = '';

                        if (file !== undefined) {
                            void openFile(file);
                        }
                    }}
                />
                <FileDrop onFile={(file) => void openFile(file)} />
                <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
                <TabLimitDialog
                    // Fechar um projeto pelo aviso libera o lugar e encerra o aviso.
                    open={limitOpen && projectCount >= MAX_OPEN_PROJECTS}
                    onCloseProject={(id) => {
                        setLimitOpen(false);
                        requestClose(id);
                    }}
                    onCancel={() => setLimitOpen(false)}
                />
                <CloseProjectDialog
                    name={
                        closingProject === undefined
                            ? null
                            : displayName(closingProject, t)
                    }
                    onExportAndClose={() => {
                        if (closingProject !== undefined) {
                            downloadProject(
                                projectStore(closingProject.id).getState().data,
                                closingProject.color,
                            );
                            useWorkspace
                                .getState()
                                .closeProject(closingProject.id);
                        }
                        setClosing(null);
                    }}
                    onDiscard={() => {
                        if (closingProject !== undefined) {
                            useWorkspace
                                .getState()
                                .closeProject(closingProject.id);
                        }
                        setClosing(null);
                    }}
                    onCancel={() => setClosing(null)}
                />
                <OpenErrorDialog
                    error={openError}
                    onClose={() => setOpenError(null)}
                />
                {tutorialOpen && (
                    <Suspense fallback={null}>
                        <Tutorial onClose={() => setTutorialOpen(false)} />
                    </Suspense>
                )}
                {submitting && (
                    <Suspense fallback={null}>
                        <SubmitDriverDialog
                            onClose={() => setSubmitting(false)}
                        />
                    </Suspense>
                )}
            </div>
            {printing && (
                <Suspense fallback={null}>
                    <PrintSheet onReady={() => window.print()} />
                </Suspense>
            )}
        </div>
    );
}
