import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { displayName } from '@/lib/project/names';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/stores/workspace';
import { SWATCH } from './swatch';

type TabLimitDialogProps = {
    open: boolean;
    onCloseProject: (id: string) => void;
    onCancel: () => void;
};

// Novo/abrir com 3 projetos abertos (FR-021b): fechar um deles libera o lugar.
export function TabLimitDialog({
    open,
    onCloseProject,
    onCancel,
}: TabLimitDialogProps) {
    const { t } = useTranslation('project');
    const projects = useWorkspace((state) => state.projects);

    return (
        <Dialog
            title={t('dialogs.limit.title')}
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    onCancel();
                }
            }}
        >
            <p className="text-sm text-muted">{t('dialogs.limit.body')}</p>
            <ul className="flex flex-col gap-1">
                {projects.map((project) => {
                    const name = displayName(project, t);

                    return (
                        <li
                            key={project.id}
                            className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1"
                        >
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'size-2.5 shrink-0 rounded-full',
                                    SWATCH[project.slot],
                                )}
                            />
                            <span className="flex-1 truncate text-sm">
                                {name}
                            </span>
                            <Button
                                variant="quiet"
                                onPress={() => onCloseProject(project.id)}
                                aria-label={t('tabs.close', { name })}
                                className="h-7 px-2"
                            >
                                <X aria-hidden="true" className="size-4" />
                            </Button>
                        </li>
                    );
                })}
            </ul>
            <div className="flex justify-end">
                <Button variant="primary" onPress={onCancel} autoFocus>
                    {t('dialogs.limit.cancel')}
                </Button>
            </div>
        </Dialog>
    );
}
