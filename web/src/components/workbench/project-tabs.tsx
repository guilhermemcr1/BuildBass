import { Eye, EyeOff, X } from 'lucide-react';
import { useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { InlineTextField } from '@/components/ui/inline-text-field';
import { ToggleButton } from '@/components/ui/toggle-button';
import { displayName } from '@/lib/project/names';
import { PROJECT_NAME_MAX } from '@/lib/project/types';
import { cn } from '@/lib/utils';
import { projectStore, useWorkspace } from '@/stores/workspace';
import type { OpenProject } from '@/stores/workspace';
import { SWATCH } from './swatch';

type ProjectTabsProps = {
    // Fechar passa pela bancada, que pede confirmação quando há alterações não exportadas.
    onClose: (id: string) => void;
};

// Projetos abertos (contracts/ui.md). Uma lista de botões, não um tablist: cada projeto tem
// também os botões de plotar e fechar, e controles dentro de uma aba ARIA não são alcançáveis.
export function ProjectTabs({ onClose }: ProjectTabsProps) {
    const { t } = useTranslation('project');
    const projects = useWorkspace((state) => state.projects);

    return (
        <nav
            aria-label={t('tabs.label')}
            className="max-w-full overflow-x-auto"
        >
            <ul className="flex items-center gap-1">
                {projects.map((project) => (
                    <ProjectTab
                        key={project.id}
                        project={project}
                        onClose={onClose}
                    />
                ))}
            </ul>
        </nav>
    );
}

function ProjectTab({
    project,
    onClose,
}: {
    project: OpenProject;
    onClose: (id: string) => void;
}) {
    const { t } = useTranslation('project');
    const active = useWorkspace((state) => state.activeId === project.id);
    const setActive = useWorkspace((state) => state.setActive);
    const togglePlotted = useWorkspace((state) => state.togglePlotted);
    const [editing, setEditing] = useState(false);
    const name = displayName(project, t);

    const rename = (next: string) => {
        setEditing(false);
        const trimmed = next.trim();

        if (trimmed !== project.data.name) {
            projectStore(project.id).getState().setName(trimmed);
        }
    };

    return (
        <li
            data-project={project.slot}
            className={cn(
                'flex h-[34px] shrink-0 items-center gap-0.5 rounded-md border pr-0.5 pl-1',
                active
                    ? 'border-border bg-raised'
                    : 'border-transparent bg-transparent',
            )}
        >
            {editing ? (
                <InlineTextField
                    label={t('tabs.rename', { name })}
                    value={project.data.name}
                    maxLength={PROJECT_NAME_MAX}
                    onCommit={rename}
                    onCancel={() => setEditing(false)}
                    className="px-1.5"
                />
            ) : (
                <div onDoubleClick={() => setEditing(true)}>
                    <AriaButton
                        aria-current={active ? 'true' : undefined}
                        onPress={() => setActive(project.id)}
                        onKeyDown={(event) => {
                            if (event.key === 'F2') {
                                setEditing(true);
                            }
                        }}
                        className={cn(
                            'flex h-7 max-w-48 cursor-default items-center gap-2 rounded-sm px-1.5 text-sm outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid',
                            active ? 'font-semibold' : 'text-muted',
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                'size-2.5 shrink-0 rounded-full',
                                SWATCH[project.slot],
                            )}
                        />
                        <span className="truncate">{name}</span>
                        {project.unsaved && (
                            <>
                                <span
                                    aria-hidden="true"
                                    className="size-1.5 shrink-0 rounded-full bg-muted"
                                />
                                <span className="sr-only">
                                    {` (${t('tabs.unsaved')})`}
                                </span>
                            </>
                        )}
                    </AriaButton>
                </div>
            )}
            <ToggleButton
                pressed={project.plotted}
                onPressedChange={() => togglePlotted(project.id)}
                aria-label={t('tabs.plot', { name })}
            >
                {project.plotted ? (
                    <Eye aria-hidden="true" className="size-4" />
                ) : (
                    <EyeOff aria-hidden="true" className="size-4" />
                )}
            </ToggleButton>
            <AriaButton
                aria-label={t('tabs.close', { name })}
                onPress={() => onClose(project.id)}
                className="inline-flex size-7 cursor-default items-center justify-center rounded-md text-muted outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-1 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:bg-surface data-[hovered]:text-foreground"
            >
                <X aria-hidden="true" className="size-4" />
            </AriaButton>
        </li>
    );
}
