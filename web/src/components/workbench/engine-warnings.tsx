import { TriangleAlert } from 'lucide-react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { useActiveProject } from '@/hooks/use-active-project';
import { useActiveSimulation } from '@/hooks/use-simulation';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// Avisos do motor para o projeto ativo, cada um com o que fazer a seguir.
export function EngineWarnings() {
    const { t } = useTranslation('engine');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const { warnings } = useActiveSimulation();
    const boxType = useActiveProject((state) => state.data.box.type);
    const length = defaultUnitFor('length', unitSystem);

    if (warnings.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            {warnings.map(({ id, chamber, values }) => (
                <Banner
                    key={`${id}-${chamber ?? ''}`}
                    tone="warn"
                    icon={TriangleAlert}
                >
                    {t(`warnings.${id}`, {
                        // Na bandpass de 4ª ordem o duto é da câmara frontal (`<aviso>_bandpass`); na de
                        // 6ª o aviso diz a câmara (`<aviso>_rear` / `<aviso>_front`), quando existe.
                        context:
                            chamber ??
                            (boxType === 'bandpass' ? 'bandpass' : undefined),
                        pipe:
                            values?.pipe_hz === undefined
                                ? undefined
                                : formatWithUnit(values.pipe_hz, 'Hz', locale),
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
