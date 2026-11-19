import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoxPanel } from '@/components/workbench/box-panel';
import { CHART_KINDS, ChartPanel } from '@/components/workbench/chart-panel';
import type { ChartKind } from '@/components/workbench/chart-panel';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
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
import { AboutDialog } from '@/components/workbench/about-dialog';
import { ShortcutsDialog } from '@/components/workbench/shortcuts-dialog';
import { TabLimitDialog } from '@/components/workbench/tab-limit-dialog';
import { TopBar } from '@/components/workbench/top-bar';
import type { ProjectAction } from '@/components/workbench/top-bar';
import {
    activeProjectStore,
    useActiveHistory,
} from '@/hooks/use-active-project';
import { useShortcuts } from '@/hooks/use-shortcuts';
import { usePreferences } from '@/stores/preferences';
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

const Assistant = lazy(() => import('@/components/assistant/assistant'));

const PrintSheet = lazy(() => import('@/components/workbench/print-sheet'));

const PlanPanel = lazy(() =>
    import('@/components/workbench/plan-panel').then((module) => ({
        default: module.PlanPanel,
    })),
);

// Layout da bancada: ≥ 1280 px lateral fixa (abas, driver, caixa) e, à direita, resultados
// numa faixa acima do gráfico; 768–1279 px driver e caixa lado a lado com resultados e gráficos em
// largura total; < 768 px uma coluna na ordem do DOM: driver → caixa → resultados → gráficos.
export default function Workbench() {
    const { t } = useTranslation(['workbench', 'project']);
    const [submitting, setSubmitting] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);
    const [aboutOpen, setAboutOpen] = useState(false);
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
    const sidebarCollapsed = usePreferences((state) => state.sidebarCollapsed);
    const setSidebarCollapsed = usePreferences(
        (state) => state.setSidebarCollapsed,
    );
    // Assistente passo a passo num modal sobre a bancada. Abre sozinho só na primeira visita, com o projeto
    // ainda sem alto-falante; depois, pelo botão da barra.
    const [assistantOpen, setAssistantOpen] = useState(() => {
        const { assistantSeen } = usePreferences.getState();
        const empty =
            Object.keys(activeProjectStore().getState().data.driver).length ===
            0;

        return !assistantSeen && empty;
    });
    const closeAssistant = () => {
        setAssistantOpen(false);
        usePreferences.getState().setAssistantSeen();
    };
    const collapseButton = useRef<HTMLButtonElement>(null);
    const expandButton = useRef<HTMLButtonElement>(null);

    // Pelo botão, o foco passa ao botão do outro estado: o que foi apertado fica oculto.
    const toggleSidebar = (collapse: boolean) => {
        setSidebarCollapsed(collapse);
        requestAnimationFrame(() =>
            (collapse ? expandButton : collapseButton).current?.focus(),
        );
    };

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

    // Projeto com alterações não salvas pede confirmação antes de fechar.
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
        } else if (id === 'sidebar') {
            // A lateral só existe em ≥ 1280 px; abaixo disso o atalho não faz nada.
            if (window.matchMedia('(min-width: 1280px)').matches) {
                setSidebarCollapsed(!sidebarCollapsed);
            }
        } else {
            runAction(id);
        }
    });

    return (
        <div className="flex min-h-dvh flex-col xl:h-dvh">
            {/* Ao imprimir o plano, só a folha do plano sai; a bancada some. */}
            <div className={printing ? 'contents print:hidden' : 'contents'}>
                <TopBar
                    onAction={runAction}
                    history={history}
                    projectName={<ProjectName />}
                    onHelp={() => setHelpOpen(true)}
                    onAbout={() => setAboutOpen(true)}
                    onTutorial={() => {
                        // O tutorial aponta para itens da lateral: ela precisa estar aberta.
                        setAssistantOpen(false);
                        setSidebarCollapsed(false);
                        setTutorialOpen(true);
                    }}
                    onAssistant={() => setAssistantOpen(true)}
                    preferences={<PreferencesBar />}
                />
                <OfflineBanner />
                {!storageAvailable && (
                    <Banner tone="warn" className="mx-3 mt-3">
                        {t('project:storage.unavailable')}
                    </Banner>
                )}
                <main
                    data-sidebar={sidebarCollapsed ? 'collapsed' : 'open'}
                    className="sidebar-grid grid flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:min-h-0 xl:gap-0 xl:p-0"
                >
                    {/* Recolhida, a lateral vira um trilho estreito só com o botão de expandir. Trilho e
                        lateral dividem a mesma célula: a coluna encolhe e os dois se cruzam. */}
                    <div className="sidebar-rail hidden xl:col-start-1 xl:row-start-1 xl:flex xl:flex-col xl:items-center xl:border-r xl:border-border xl:bg-surface xl:py-2.5">
                        <Tooltip content={t('sidebar.expand')}>
                            <Button
                                ref={expandButton}
                                variant="quiet"
                                aria-label={t('sidebar.expand')}
                                aria-expanded={false}
                                onPress={() => toggleSidebar(false)}
                                className="px-2"
                            >
                                <PanelLeftOpen
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            </Button>
                        </Tooltip>
                    </div>
                    {/* Em ≥ 1280 px uma lateral fixa (abas, driver e caixa) com rolagem própria; abaixo
                        disso o wrapper some e cada bloco vira item da grade. Recolhida, continua
                        montada (sem perder estado), só oculta. */}
                    <div className="sidebar-content contents xl:relative xl:col-start-1 xl:row-start-1 xl:flex xl:min-h-0 xl:[scrollbar-gutter:stable] xl:flex-col xl:overflow-x-hidden xl:overflow-y-auto xl:border-r xl:border-border xl:bg-surface">
                        <div className="flex items-center gap-1 md:col-span-2 xl:col-span-1 xl:px-3 xl:py-2.5">
                            <div data-tour="tabs" className="min-w-0 flex-1">
                                <ProjectTabs onClose={requestClose} />
                            </div>
                            <Tooltip content={t('sidebar.collapse')}>
                                <Button
                                    variant="quiet"
                                    ref={collapseButton}
                                    aria-label={t('sidebar.collapse')}
                                    aria-expanded={true}
                                    onPress={() => toggleSidebar(true)}
                                    className="hidden shrink-0 px-2 xl:inline-flex"
                                >
                                    <PanelLeftClose
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                </Button>
                            </Tooltip>
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
                <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
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
                {assistantOpen && (
                    <Suspense fallback={null}>
                        <Assistant onClose={closeAssistant} />
                    </Suspense>
                )}
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
