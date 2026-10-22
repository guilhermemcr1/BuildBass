import { useState } from 'react';
import { Input, TextField } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { displayName } from '@/lib/project/names';
import { PROJECT_NAME_MAX } from '@/lib/project/types';
import { projectStore, useWorkspace } from '@/stores/workspace';

// Nome do projeto ativo, editável direto na barra superior. Enter ou sair do campo confirma,
// Esc cancela e nome vazio volta ao anterior.
export function ProjectName() {
    const { t } = useTranslation('project');
    const project = useWorkspace((state) =>
        state.projects.find((entry) => entry.id === state.activeId),
    );

    if (project === undefined) {
        return null;
    }

    return (
        <NameField
            key={project.id}
            id={project.id}
            shown={displayName(project, t)}
            label={t('name.label')}
        />
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
            className="max-w-64 min-w-0 flex-1"
        >
            <Input
                onFocus={(event) => event.currentTarget.select()}
                className="h-[34px] w-full truncate rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-foreground outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[focused]:border-accent data-[hovered]:border-border"
            />
        </TextField>
    );
}
