import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SHORTCUTS, appleKeyboard, shortcutKeys } from '@/hooks/use-shortcuts';
import type { ShortcutId } from '@/hooks/use-shortcuts';

type ShortcutsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const LABEL_KEYS: Record<ShortcutId, string> = {
    new: 'actions.new',
    open: 'actions.open',
    export: 'actions.export',
    undo: 'actions.undo',
    redo: 'actions.redo',
    chartTabs: 'shortcuts.chartTabs',
    sidebar: 'shortcuts.sidebar',
    help: 'shortcuts.help',
};

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
    const { t } = useTranslation(['workbench', 'common']);
    const apple = appleKeyboard();

    return (
        <Dialog
            title={t('shortcuts.title')}
            open={open}
            onOpenChange={onOpenChange}
        >
            <dl className="flex flex-col divide-y divide-border text-sm">
                {SHORTCUTS.map((shortcut) => (
                    <div
                        key={shortcut.id}
                        className="flex items-center justify-between gap-4 py-2"
                    >
                        <dt>{t(LABEL_KEYS[shortcut.id])}</dt>
                        <dd className="flex gap-1">
                            {shortcutKeys(shortcut, apple).map((key) => (
                                <kbd
                                    key={key}
                                    className="min-w-6 rounded-sm border border-border bg-raised px-1.5 py-0.5 text-center num text-xs"
                                >
                                    {key}
                                </kbd>
                            ))}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="text-xs text-muted">{t('shortcuts.hint')}</p>
            <div className="flex justify-end">
                <Button
                    variant="primary"
                    onPress={() => onOpenChange(false)}
                    autoFocus
                >
                    {t('common:comingSoon.close')}
                </Button>
            </div>
        </Dialog>
    );
}
