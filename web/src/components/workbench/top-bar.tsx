import {
    Download,
    FilePlus,
    FolderOpen,
    GraduationCap,
    Info,
    Keyboard,
    Redo2,
    Undo2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export type ProjectAction = 'new' | 'open' | 'export' | 'undo' | 'redo';

type TopBarProps = {
    onAction: (action: ProjectAction) => void;
    history: { canUndo: boolean; canRedo: boolean };
    // Nome do projeto ativo (editável), entre as ações e as preferências.
    projectName?: ReactNode;
    onHelp: () => void;
    onAbout: () => void;
    onTutorial: () => void;
    preferences?: ReactNode;
};

export function TopBar({
    onAction,
    history,
    projectName,
    onHelp,
    onAbout,
    onTutorial,
    preferences,
}: TopBarProps) {
    const { t } = useTranslation(['common', 'workbench']);

    return (
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2.5">
            <span className="text-lg font-bold tracking-tight">
                {t('common:appName')}
            </span>
            <nav
                aria-label={t('common:appName')}
                data-tour="actions"
                className="flex flex-wrap items-center gap-1"
            >
                <Button variant="quiet" onPress={() => onAction('new')}>
                    <FilePlus aria-hidden="true" className="size-4" />
                    {t('workbench:actions.new')}
                </Button>
                <Button variant="quiet" onPress={() => onAction('open')}>
                    <FolderOpen aria-hidden="true" className="size-4" />
                    {t('workbench:actions.open')}
                </Button>
                <Button variant="primary" onPress={() => onAction('export')}>
                    <Download aria-hidden="true" className="size-4" />
                    {t('workbench:actions.export')}
                </Button>
                <Button
                    variant="quiet"
                    onPress={() => onAction('undo')}
                    disabled={!history.canUndo}
                    aria-label={t('workbench:actions.undo')}
                    className="px-2.5"
                >
                    <Undo2 aria-hidden="true" className="size-4" />
                </Button>
                <Button
                    variant="quiet"
                    onPress={() => onAction('redo')}
                    disabled={!history.canRedo}
                    aria-label={t('workbench:actions.redo')}
                    className="px-2.5"
                >
                    <Redo2 aria-hidden="true" className="size-4" />
                </Button>
            </nav>
            {projectName}
            <div className="ml-auto flex flex-wrap items-center gap-2">
                <div
                    data-tour="preferences"
                    className="flex flex-wrap items-center gap-2"
                >
                    {preferences}
                </div>
                <Button variant="quiet" onPress={onTutorial}>
                    <GraduationCap aria-hidden="true" className="size-4" />
                    <span className="hidden sm:inline">
                        {t('workbench:actions.tutorial')}
                    </span>
                    <span className="sr-only sm:hidden">
                        {t('workbench:actions.tutorial')}
                    </span>
                </Button>
                <Button
                    variant="quiet"
                    onPress={onHelp}
                    aria-label={t('workbench:actions.help')}
                    className="px-2.5"
                >
                    <Keyboard aria-hidden="true" className="size-4" />
                </Button>
                <Button
                    variant="quiet"
                    onPress={onAbout}
                    aria-label={t('workbench:actions.about')}
                    className="px-2.5"
                >
                    <Info aria-hidden="true" className="size-4" />
                </Button>
            </div>
        </header>
    );
}
