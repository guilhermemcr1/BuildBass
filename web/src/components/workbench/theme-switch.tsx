import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Menu } from '@/components/ui/menu';
import { usePreferences } from '@/stores/preferences';
import type { ThemeChoice } from '@/stores/preferences';

const ICONS = { light: Sun, dark: Moon, system: Monitor };
const CHOICES: ThemeChoice[] = ['light', 'dark', 'system'];

// Um botão só com o ícone do tema atual que abre a lista; o nome fica no rótulo acessível e as três
// opções só aparecem ao abrir.
export function ThemeSwitch() {
    const { t } = useTranslation('common');
    const theme = usePreferences((state) => state.theme);
    const setTheme = usePreferences((state) => state.setTheme);
    const Current = ICONS[theme];

    return (
        <Menu<ThemeChoice>
            label={t('theme.label')}
            triggerLabel={t('theme.current', { name: t(`theme.${theme}`) })}
            selected={theme}
            onAction={setTheme}
            items={CHOICES.map((id) => {
                const Icon = ICONS[id];

                return {
                    id,
                    label: t(`theme.${id}`),
                    icon: <Icon aria-hidden="true" className="size-4" />,
                };
            })}
            trigger={
                <span className="flex size-8 items-center justify-center rounded-md border border-border bg-raised text-foreground">
                    <Current aria-hidden="true" className="size-4" />
                </span>
            }
        />
    );
}
