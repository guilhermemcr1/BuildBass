import { Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
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

// O Modo Pro fica à vista na barra (muda o trabalho na hora); unidades, tema e idioma, que se
// escolhem uma vez, ficam juntos no popover "Preferências". Abaixo de 768 px o Modo Pro também
// entra no popover, para a barra caber numa linha.
export function PreferencesBar() {
    const { t } = useTranslation('common');

    return (
        <>
            <div className="hidden md:flex">
                <ModeSwitch />
            </div>
            <DialogTrigger>
                <AriaButton
                    aria-label={t('preferences')}
                    className="flex h-8 cursor-default items-center gap-1.5 rounded-md px-2.5 text-[13px] text-foreground outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[hovered]:bg-raised data-[pressed]:bg-raised"
                >
                    <Settings2 aria-hidden="true" className="size-4" />
                    <span className="hidden lg:inline">{t('preferences')}</span>
                </AriaButton>
                <Popover
                    placement="bottom end"
                    offset={6}
                    className="w-72 max-w-[calc(100vw-2rem)] pop rounded-lg border border-border bg-surface p-3 shadow-xl"
                >
                    <Dialog
                        aria-label={t('preferences')}
                        className="flex flex-col gap-3 outline-none"
                    >
                        <div className="md:hidden">
                            <ModeSwitch />
                        </div>
                        <Row label={t('units.system')}>
                            <UnitSystemSwitch />
                        </Row>
                        <Row label={t('theme.label')}>
                            <ThemeSwitch />
                        </Row>
                        <Row label={t('language.label')}>
                            <LanguageSwitch />
                        </Row>
                    </Dialog>
                </Popover>
            </DialogTrigger>
        </>
    );
}

// Rótulo visível só para quem vê: cada controle já tem o próprio nome acessível.
function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span aria-hidden="true" className="text-xs text-muted">
                {label}
            </span>
            {children}
        </div>
    );
}
