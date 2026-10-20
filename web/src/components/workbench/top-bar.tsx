import {
    Download,
    FilePlus,
    FolderOpen,
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
    // Abas dos projetos abertos, entre as ações e as preferências.
    tabs?: ReactNode;
    onHelp: () => void;
    preferences?: ReactNode;
};

export function TopBar({
    onAction,
    history,
    tabs,
    onHelp,
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
            {tabs}
            <div className="ml-auto flex flex-wrap items-center gap-2">
                {preferences}
                <Button
                    variant="quiet"
                    onPress={onHelp}
                    aria-label={t('workbench:actions.help')}
                    className="px-2.5"
                >
                    <Keyboard aria-hidden="true" className="size-4" />
                </Button>
            </div>
        </header>
    );
}
