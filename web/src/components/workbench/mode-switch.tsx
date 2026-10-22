import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch';
import { usePreferences } from '@/stores/preferences';

// Normal: só os campos essenciais; Pro: tudo aberto. Trocar de modo abre ou recolhe todos os
// "Mostrar mais" (stores/expanded.ts).
export function ModeSwitch() {
    const { t } = useTranslation('common');
    const mode = usePreferences((state) => state.mode);
    const setMode = usePreferences((state) => state.setMode);

    return (
        <Switch
            selected={mode === 'pro'}
            onChange={(pro) => setMode(pro ? 'pro' : 'normal')}
        >
            {t('mode.proSwitch')}
        </Switch>
    );
}
