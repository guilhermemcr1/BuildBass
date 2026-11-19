import { FileUp, PencilLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button as AriaButton } from 'react-aria-components';
import { Button } from '@/components/ui/button';

export type SubmitPath = 'manual' | 'fields';

type SubmitChoiceProps = {
    onChoose: (path: SubmitPath) => void;
    onCancel: () => void;
};

const OPTIONS: { path: SubmitPath; icon: LucideIcon }[] = [
    { path: 'manual', icon: FileUp },
    { path: 'fields', icon: PencilLine },
];

// Primeira etapa do envio: anexar o manual (a IA preenche) ou digitar os campos.
export function SubmitChoice({ onChoose, onCancel }: SubmitChoiceProps) {
    const { t } = useTranslation('submission');

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t('choice.title')}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {OPTIONS.map(({ path, icon: Icon }) => (
                    <AriaButton
                        key={path}
                        onPress={() => onChoose(path)}
                        className="flex flex-col items-start gap-2 rounded-md border border-border p-4 text-left transition-colors outline-none hover:border-accent hover:bg-accent/5 focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        <Icon
                            aria-hidden="true"
                            className="size-5 text-accent"
                        />
                        <span className="text-sm font-semibold">
                            {t(`choice.${path}`)}
                        </span>
                        <span className="text-xs text-muted">
                            {t(`choice.${path}Hint`)}
                        </span>
                    </AriaButton>
                ))}
            </div>
            <div className="flex justify-end">
                <Button variant="secondary" onPress={onCancel}>
                    {t('actions.cancel')}
                </Button>
            </div>
        </div>
    );
}
