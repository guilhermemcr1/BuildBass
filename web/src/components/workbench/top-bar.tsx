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
            {/* Marca do README: cone de alto-falante visto de frente; "Bass" na cor de destaque do tema. */}
            <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                <svg
                    viewBox="0 0 120 120"
                    aria-hidden="true"
                    className="size-7 shrink-0"
                >
                    <rect width="120" height="120" rx="26" fill="#121212" />
                    <circle
                        cx="60"
                        cy="60"
                        r="40"
                        fill="none"
                        stroke="#b8f53d"
                        strokeWidth="8"
                    />
                    <circle
                        cx="60"
                        cy="60"
                        r="26"
                        fill="none"
                        stroke="#b8f53d"
                        strokeOpacity=".45"
                        strokeWidth="3.5"
                    />
                    <circle cx="60" cy="60" r="14" fill="#b8f53d" />
                </svg>
                <span>
                    Build<span className="text-accent">Bass</span>
                </span>
            </span>
            <nav
                aria-label={t('common:appName')}
                data-tour="actions"
                className="flex items-center gap-1 max-sm:order-last max-sm:w-full max-sm:justify-between max-sm:border-t max-sm:border-border max-sm:pt-2"
            >
                <Button
                    variant="quiet"
                    onPress={() => onAction('new')}
                    className="max-sm:px-2.5"
                >
                    <FilePlus aria-hidden="true" className="size-4" />
                    <span className="max-sm:sr-only">
                        {t('workbench:actions.new')}
                    </span>
                </Button>
                <Button
                    variant="quiet"
                    onPress={() => onAction('open')}
                    className="max-sm:px-2.5"
                >
                    <FolderOpen aria-hidden="true" className="size-4" />
                    <span className="max-sm:sr-only">
                        {t('workbench:actions.open')}
                    </span>
                </Button>
                <Button variant="primary" onPress={() => onAction('export')}>
                    <Download aria-hidden="true" className="size-4" />
                    {t('workbench:actions.export')}
                </Button>
                {/* Desfazer e refazer juntos: no celular não se separam em linhas diferentes. */}
                <div className="flex shrink-0 items-center">
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
                </div>
            </nav>
            {/* No celular a aba do projeto, logo abaixo, já mostra e edita nome e cor. */}
            {projectName !== undefined && (
                <div className="hidden min-w-0 flex-1 sm:flex">
                    {projectName}
                </div>
            )}
            {/* No celular: marca e utilitários na 1ª linha; as ações do projeto ocupam a 2ª inteira. */}
            <div className="ml-auto flex items-center gap-1 sm:flex-wrap sm:gap-2">
                <div
                    data-tour="preferences"
                    className="flex flex-wrap items-center gap-2"
                >
                    {preferences}
                </div>
                <Button
                    variant="quiet"
                    onPress={onTutorial}
                    className="max-sm:px-2.5"
                >
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
                    className="px-2.5 max-sm:hidden"
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
