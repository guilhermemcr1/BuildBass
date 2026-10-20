import { TriangleAlert } from 'lucide-react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { useActiveSimulation } from '@/hooks/use-simulation';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// Avisos do motor para o projeto ativo (FR-010), cada um com o que fazer a seguir.
export function EngineWarnings() {
    const { t } = useTranslation('engine');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const { warnings } = useActiveSimulation();
    const length = defaultUnitFor('length', unitSystem);

    if (warnings.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            {warnings.map(({ id, values }) => (
                <Banner key={id} tone="warn" icon={TriangleAlert}>
                    {t(`warnings.${id}`, {
                        length:
                            values?.length_m === undefined
                                ? undefined
                                : formatWithUnit(
                                      values.length_m,
                                      length,
                                      locale,
                                  ),
                    })}
                </Banner>
            ))}
        </div>
    );
}
