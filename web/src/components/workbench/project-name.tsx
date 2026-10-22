import { useState } from 'react';
import {
    Button as AriaButton,
    Dialog,
    DialogTrigger,
    Input,
    Popover,
    TextField,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ColorPicker } from '@/components/ui/color-picker';
import { displayName } from '@/lib/project/names';
import { PROJECT_NAME_MAX } from '@/lib/project/types';
import type { SeriesColor } from '@/lib/project/types';
import { cn } from '@/lib/utils';
import { projectStore, useWorkspace } from '@/stores/workspace';
import { SWATCH } from './swatch';

// Cor e nome do projeto ativo, editáveis direto na barra superior. No nome, Enter ou sair do
// campo confirma, Esc cancela e nome vazio volta ao anterior.
export function ProjectName() {
    const { t } = useTranslation('project');
    const project = useWorkspace((state) =>
        state.projects.find((entry) => entry.id === state.activeId),
    );

    if (project === undefined) {
        return null;
    }

    const name = displayName(project, t);

    return (
        <div className="flex max-w-72 min-w-0 flex-1 items-center gap-0.5">
            <ColorField
                id={project.id}
                color={project.color}
                label={t('tabs.colorOf', { name })}
                dialogLabel={t('tabs.color')}
            />
            <NameField
                key={project.id}
                id={project.id}
                shown={name}
                label={t('name.label')}
            />
        </div>
    );
}

function ColorField({
    id,
    color,
    label,
    dialogLabel,
}: {
    id: string;
    color: SeriesColor;
    label: string;
    dialogLabel: string;
}) {
    const setColor = useWorkspace((state) => state.setColor);

    return (
        <DialogTrigger>
            <AriaButton
                aria-label={label}
                className="flex size-8 shrink-0 cursor-default items-center justify-center rounded-md outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:bg-raised"
            >
                <span
                    aria-hidden="true"
                    className={cn('size-3.5 rounded-full', SWATCH[color])}
                />
            </AriaButton>
            <Popover
                placement="bottom start"
                offset={4}
                className="rounded-md border border-border bg-raised p-2 shadow-lg"
            >
                <Dialog aria-label={dialogLabel} className="outline-none">
                    <ColorPicker
                        value={color}
                        onChange={(next) => setColor(id, next)}
                    />
                </Dialog>
            </Popover>
        </DialogTrigger>
    );
}

function NameField({
    id,
    shown,
    label,
}: {
    id: string;
    shown: string;
    label: string;
}) {
    const [draft, setDraft] = useState(shown);
    const [seen, setSeen] = useState(shown);

    // O nome mudou por fora (renomeado na aba, desfazer): o campo acompanha.
    if (seen !== shown) {
        setSeen(shown);
        setDraft(shown);
    }

    const commit = () => {
        const trimmed = draft.trim();

        if (trimmed === '' || trimmed === shown) {
            setDraft(shown);

            return;
        }

        projectStore(id).getState().setName(trimmed);
    };

    return (
        <TextField
            aria-label={label}
            value={draft}
            onChange={setDraft}
            maxLength={PROJECT_NAME_MAX}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    commit();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setDraft(shown);
                }
            }}
            onBlur={commit}
            className="min-w-0 flex-1"
        >
            <Input
                onFocus={(event) => event.currentTarget.select()}
                className="h-[34px] w-full truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-foreground outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[focused]:border-accent data-[hovered]:border-border"
            />
        </TextField>
    );
}
