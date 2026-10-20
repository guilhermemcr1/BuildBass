import { Settings2 } from 'lucide-react';
import {
    Button as AriaButton,
    Dialog,
    DialogTrigger,
    Popover,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from './language-switch';
import { ThemeSwitch } from './theme-switch';
import { UnitSystemSwitch } from './unit-system-switch';

// Desktop: controles visíveis na barra. Abaixo de 768 px ficam num popover "Preferências" para não
// empurrar a barra para três linhas.
export function PreferencesBar() {
    const { t } = useTranslation('common');

    return (
        <>
            <div className="hidden items-center gap-2 md:flex">
                <UnitSystemSwitch />
                <ThemeSwitch />
                <LanguageSwitch />
            </div>
            <DialogTrigger>
                <AriaButton className="flex h-[34px] cursor-default items-center gap-1.5 rounded-md border border-border bg-raised px-2.5 text-[13px] text-foreground outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent md:hidden">
                    <Settings2 aria-hidden="true" className="size-4" />
                    {t('preferences')}
                </AriaButton>
                <Popover
                    placement="bottom end"
                    offset={6}
                    className="rounded-lg border border-border bg-surface p-3 shadow-xl"
                >
                    <Dialog
                        aria-label={t('preferences')}
                        className="flex flex-col items-start gap-3 outline-none"
                    >
                        <UnitSystemSwitch />
                        <ThemeSwitch />
                        <LanguageSwitch />
                    </Dialog>
                </Popover>
            </DialogTrigger>
        </>
    );
}
