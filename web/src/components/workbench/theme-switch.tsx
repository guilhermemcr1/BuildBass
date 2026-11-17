import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { usePreferences } from '@/stores/preferences';
import type { ThemeChoice } from '@/stores/preferences';

const ICONS = { light: Sun, dark: Moon, system: Monitor };
const CHOICES: ThemeChoice[] = ['light', 'dark', 'system'];

// As três opções sempre à vista (claro, escuro, sistema), com a escolhida marcada: dá para ver o
// que o controle faz sem abrir nada. O nome de cada uma fica no rótulo acessível e na dica.
export function ThemeSwitch() {
    const { t } = useTranslation('common');
    const theme = usePreferences((state) => state.theme);
    const setTheme = usePreferences((state) => state.setTheme);

    return (
        <SegmentedControl<ThemeChoice>
            label={t('theme.label')}
            selected={theme}
            onChange={setTheme}
            options={CHOICES.map((id) => {
                const Icon = ICONS[id];

                return {
                    id,
                    label: t(`theme.${id}`),
                    icon: <Icon aria-hidden="true" className="size-4" />,
                    iconOnly: true,
                };
            })}
        />
    );
}
