import { X } from 'lucide-react';
import { useRef, useState } from 'react';
import {
    Button as AriaButton,
    Dialog as AriaDialog,
    Popover,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { InlineTextField } from '@/components/ui/inline-text-field';
import { ToggleButton } from '@/components/ui/toggle-button';
import { displayName } from '@/lib/project/names';
import { PROJECT_NAME_MAX } from '@/lib/project/types';
import { cn } from '@/lib/utils';
import { projectStore, useWorkspace } from '@/stores/workspace';
import type { OpenProject } from '@/stores/workspace';
import { RING_SWATCH, SWATCH } from './swatch';

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
        <nav aria-label={t('tabs.label')} className="max-w-full">
            {/* Até 3 projetos dividem a largura em partes iguais, sem rolagem horizontal. */}
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
    const chip = useRef<HTMLLIElement>(null);
    const name = displayName(project, t);

    const rename = (next: string) => {
        setEditing(false);
        const trimmed = next.trim();

        // Nome vazio mantém o anterior.
        if (trimmed !== '' && trimmed !== project.data.name) {
            projectStore(project.id).getState().setName(trimmed);
        }
    };

    return (
        <li
            ref={chip}
            data-project={project.color}
            className={cn(
                'group/tab relative flex h-8 min-w-0 items-center rounded-md border pr-0.5 pl-1 motion-safe:transition-colors',
                active
                    ? 'max-w-72 flex-[1.8] border-border bg-raised'
                    : 'max-w-56 flex-1 border-transparent bg-transparent hover:bg-raised/60',
            )}
        >
            {/* O ponto da cor é a legenda do gráfico e o botão de mostrar ou esconder a curva:
                cheio = no gráfico, só o aro = fora dele. */}
            <ToggleButton
                pressed={project.plotted}
                onPressedChange={() => togglePlotted(project.id)}
                aria-label={t('tabs.plot', { name })}
                className="size-6 shrink-0 text-inherit"
            >
                <span
                    aria-hidden="true"
                    className={cn(
                        'size-2.5 rounded-full border-2',
                        project.plotted
                            ? cn('border-transparent', SWATCH[project.color])
                            : cn('bg-transparent', RING_SWATCH[project.color]),
                    )}
                />
            </ToggleButton>
            <div
                className="min-w-0 flex-1"
                onDoubleClick={() => setEditing(true)}
            >
                <AriaButton
                    aria-current={active ? 'true' : undefined}
                    onPress={() => setActive(project.id)}
                    onKeyDown={(event) => {
                        if (event.key === 'F2') {
                            setEditing(true);
                        }
                    }}
                    className={cn(
                        'flex h-7 w-full min-w-0 cursor-default items-center gap-1.5 rounded-sm px-1 text-[13px] outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid',
                        active ? 'font-semibold' : 'text-muted',
                    )}
                >
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
            {/* O nome edita num balão preso à aba: um campo dentro do chip o estourava e cobria as
                abas vizinhas. */}
            <Popover
                isOpen={editing}
                onOpenChange={setEditing}
                triggerRef={chip}
                placement="bottom start"
                offset={4}
                className="pop rounded-md border border-border bg-raised p-1.5 shadow-lg"
            >
                <AriaDialog
                    aria-label={t('tabs.rename', { name })}
                    className="outline-none"
                >
                    <InlineTextField
                        label={t('tabs.rename', { name })}
                        value={project.data.name}
                        maxLength={PROJECT_NAME_MAX}
                        onCommit={rename}
                        onCancel={() => setEditing(false)}
                    />
                </AriaDialog>
            </Popover>
            {/* O X aparece na aba ativa, ao pairar ou ao focar; em tela de toque fica sempre. */}
            <AriaButton
                aria-label={t('tabs.close', { name })}
                onPress={() => onClose(project.id)}
                className={cn(
                    'inline-flex size-6 shrink-0 cursor-default items-center justify-center rounded-md text-muted outline-none data-[focus-visible]:opacity-100 data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-1 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:bg-surface data-[hovered]:text-foreground motion-safe:transition-opacity pointer-coarse:opacity-100',
                    active
                        ? 'opacity-100'
                        : 'absolute top-1/2 right-0.5 -translate-y-1/2 bg-raised opacity-0 group-focus-within/tab:opacity-100 group-hover/tab:opacity-100',
                )}
            >
                <X aria-hidden="true" className="size-3.5" />
            </AriaButton>
        </li>
    );
}
