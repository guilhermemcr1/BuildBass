import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { usePreferences } from '@/stores/preferences';
import type { ThemeChoice } from '@/stores/preferences';

export function ThemeSwitch() {
    const { t } = useTranslation('common');
    const theme = usePreferences((state) => state.theme);
    const setTheme = usePreferences((state) => state.setTheme);

    return (
        <SegmentedControl<ThemeChoice>
            label={t('theme.label')}
            selected={theme}
            onChange={setTheme}
            options={[
                { id: 'light', label: t('theme.light') },
                { id: 'dark', label: t('theme.dark') },
                { id: 'system', label: t('theme.system') },
            ]}
        />
    );
}
