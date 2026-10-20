import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoxPanel } from '@/components/workbench/box-panel';
import { CHART_KINDS, ChartPanel } from '@/components/workbench/chart-panel';
import type { ChartKind } from '@/components/workbench/chart-panel';
import { ComingSoonDialog } from '@/components/workbench/coming-soon-dialog';
import { Banner } from '@/components/ui/banner';
import { CloseProjectDialog } from '@/components/workbench/close-project-dialog';
import { DriverPanel } from '@/components/workbench/driver-panel';
import { FileDrop } from '@/components/workbench/file-drop';
import { OpenErrorDialog } from '@/components/workbench/open-error-dialog';
import type { OpenError } from '@/components/workbench/open-error-dialog';
import { OfflineBanner } from '@/components/workbench/offline-banner';
import { PreferencesBar } from '@/components/workbench/preferences-bar';
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

// Layout da bancada (FR-007): ≥ 1280 px três colunas (driver | caixa + resultados | gráficos),
// 768–1279 px duas colunas com gráficos e resultados em largura total, < 768 px uma coluna na
// ordem do DOM: driver → caixa → gráficos → resultados.
export default function Workbench() {
    const { t } = useTranslation(['workbench', 'project']);
    const [pending, setPending] = useState<string | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [limitOpen, setLimitOpen] = useState(false);
    const [openError, setOpenError] = useState<OpenError | null>(null);
    const [closing, setClosing] = useState<string | null>(null);
    const projectCount = useWorkspace((state) => state.projects.length);
    const storageAvailable = useWorkspace((state) => state.storageAvailable);
    const closingProject = useWorkspace((state) =>
        state.projects.find((p) => p.id === closing),
    );
    const [chart, setChart] = useState<ChartKind>('response');
    const fileInput = useRef<HTMLInputElement>(null);
    const history = useActiveHistory();

    const openFile = async (file: File) => {
        const result = await parseProjectFile(file);

        if (!result.ok) {
            setOpenError({ code: result.code, path: result.path });
        } else if (
            useWorkspace.getState().openProject(result.data) === 'limit'
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
                downloadProject(activeProjectStore().getState().data);
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
        <div className="flex min-h-dvh flex-col">
            <TopBar
                onAction={runAction}
                history={history}
                tabs={<ProjectTabs onClose={requestClose} />}
                onHelp={() => setHelpOpen(true)}
                preferences={<PreferencesBar />}
            />
            <OfflineBanner />
            {!storageAvailable && (
                <Banner tone="warn" className="mx-3 mt-3">
                    {t('project:storage.unavailable')}
                </Banner>
            )}
            <main className="grid flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-[minmax(300px,360px)_minmax(260px,320px)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
                {/* Em ≥ 1280 px o driver ocupa as duas linhas: a altura dele não empurra os resultados. */}
                <div className="xl:row-span-2">
                    <DriverPanel
                        onSubmitDriver={() => setPending(t('catalog.submit'))}
                    />
                </div>
                <BoxPanel />
                <div className="md:col-span-2 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:flex xl:flex-col [&>section]:flex-1">
                    <ChartPanel selected={chart} onSelectedChange={setChart} />
                </div>
                <div className="md:col-span-2 xl:col-span-1 xl:col-start-2 xl:row-start-2">
                    <ResultsPanel />
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
                        );
                        useWorkspace.getState().closeProject(closingProject.id);
                    }
                    setClosing(null);
                }}
                onDiscard={() => {
                    if (closingProject !== undefined) {
                        useWorkspace.getState().closeProject(closingProject.id);
                    }
                    setClosing(null);
                }}
                onCancel={() => setClosing(null)}
            />
            <OpenErrorDialog
                error={openError}
                onClose={() => setOpenError(null)}
            />
            <ComingSoonDialog
                action={pending}
                onClose={() => setPending(null)}
            />
        </div>
    );
}
