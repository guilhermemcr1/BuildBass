import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { usePreferences } from '@/stores/preferences';
import type { Mode } from '@/stores/preferences';

// Normal: só os campos essenciais; Pro: tudo aberto. Trocar de modo abre ou recolhe todos os
// "Mostrar mais" (stores/expanded.ts).
export function ModeSwitch() {
    const { t } = useTranslation('common');
    const mode = usePreferences((state) => state.mode);
    const setMode = usePreferences((state) => state.setMode);

    return (
        <SegmentedControl<Mode>
            label={t('mode.label')}
            selected={mode}
            onChange={setMode}
            options={[
                { id: 'normal', label: t('mode.normal') },
                { id: 'pro', label: t('mode.pro') },
            ]}
        />
    );
}
