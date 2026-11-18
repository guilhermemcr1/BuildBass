import { Settings2 } from 'lucide-react';
import {
    Button as AriaButton,
    Dialog,
    DialogTrigger,
    Popover,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from './language-switch';
import { ModeSwitch } from './mode-switch';
import { ThemeSwitch } from './theme-switch';
import { UnitSystemSwitch } from './unit-system-switch';

// Desktop: controles visíveis na barra. Abaixo de 768 px ficam num popover "Preferências" para não
// empurrar a barra para três linhas.
export function PreferencesBar() {
    const { t } = useTranslation('common');

    return (
        <>
            <div className="hidden items-center gap-2 md:flex">
                <ModeSwitch />
                <UnitSystemSwitch />
                <ThemeSwitch />
                <LanguageSwitch />
            </div>
            <DialogTrigger>
                <AriaButton
                    aria-label={t('preferences')}
                    className="flex h-8 cursor-default items-center gap-1.5 rounded-md border border-border bg-raised px-2.5 text-[13px] text-foreground outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid md:hidden"
                >
                    <Settings2 aria-hidden="true" className="size-4" />
                    <span className="max-sm:sr-only">{t('preferences')}</span>
                </AriaButton>
                <Popover
                    placement="bottom end"
                    offset={6}
                    className="pop rounded-lg border border-border bg-surface p-3 shadow-xl"
                >
                    <Dialog
                        aria-label={t('preferences')}
                        className="flex flex-col items-start gap-3 outline-none"
                    >
                        <ModeSwitch />
                        <UnitSystemSwitch />
                        <ThemeSwitch />
                        <LanguageSwitch />
                    </Dialog>
                </Popover>
            </DialogTrigger>
        </>
    );
}
