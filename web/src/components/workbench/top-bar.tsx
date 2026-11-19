import {
    CircleHelp,
    Download,
    FilePlus,
    FolderOpen,
    GraduationCap,
    Info,
    Keyboard,
    Redo2,
    Undo2,
    WandSparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { Menu } from '@/components/ui/menu';

export type ProjectAction = 'new' | 'open' | 'export' | 'undo' | 'redo';

type HelpAction = 'tutorial' | 'shortcuts' | 'about';

type TopBarProps = {
    onAction: (action: ProjectAction) => void;
    history: { canUndo: boolean; canRedo: boolean };
    // Nome do projeto ativo (editável), entre as ações e as preferências.
    projectName?: ReactNode;
    onHelp: () => void;
    onAbout: () => void;
    onTutorial: () => void;
    // Abre o assistente passo a passo (alto-falante → caixa → conferência).
    onAssistant?: () => void;
    preferences?: ReactNode;
};

export function TopBar({
    onAction,
    history,
    projectName,
    onHelp,
    onAbout,
    onTutorial,
    onAssistant,
    preferences,
}: TopBarProps) {
    const { t } = useTranslation(['common', 'workbench']);

    return (
        <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2.5">
            {/* Marca do README: cone de alto-falante visto de frente; "Bass" na cor de destaque do tema. */}
            <span className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
                <BrandMark className="size-7" />
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
            <div className="ml-auto flex items-center gap-1">
                {onAssistant !== undefined && (
                    <Button
                        variant="quiet"
                        onPress={onAssistant}
                        className="max-sm:px-2.5"
                    >
                        <WandSparkles aria-hidden="true" className="size-4" />
                        <span className="hidden sm:inline">
                            {t('workbench:actions.assistant')}
                        </span>
                        <span className="sr-only sm:hidden">
                            {t('workbench:actions.assistant')}
                        </span>
                    </Button>
                )}
                <div
                    data-tour="preferences"
                    className="flex items-center gap-1 md:gap-2"
                >
                    {preferences}
                </div>
                <Menu<HelpAction>
                    label={t('workbench:actions.helpMenu')}
                    trigger={
                        <span className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-foreground">
                            <CircleHelp aria-hidden="true" className="size-4" />
                            <span className="hidden lg:inline">
                                {t('workbench:actions.helpMenu')}
                            </span>
                        </span>
                    }
                    triggerClassName="rounded-md data-[hovered]:bg-raised data-[pressed]:bg-raised"
                    items={[
                        {
                            id: 'tutorial',
                            label: t('workbench:actions.tutorial'),
                            icon: (
                                <GraduationCap
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            ),
                        },
                        {
                            id: 'shortcuts',
                            label: t('workbench:actions.help'),
                            icon: (
                                <Keyboard
                                    aria-hidden="true"
                                    className="size-4"
                                />
                            ),
                        },
                        {
                            id: 'about',
                            label: t('workbench:actions.about'),
                            icon: (
                                <Info aria-hidden="true" className="size-4" />
                            ),
                        },
                    ]}
                    onAction={(action) => {
                        if (action === 'tutorial') {
                            onTutorial();
                        } else if (action === 'shortcuts') {
                            onHelp();
                        } else {
                            onAbout();
                        }
                    }}
                />
            </div>
        </header>
    );
}
