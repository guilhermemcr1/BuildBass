import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { usePreferences } from '@/stores/preferences';
import type { BoxMeasure } from '@/stores/preferences';

// Internas ou externas: a escolha da pessoa vale em toda a aplicação; antes dela, cada tela usa o
// seu padrão (a bancada pensa por dentro, o assistente por fora).
export function useBoxMeasure(fallback: BoxMeasure) {
    const chosen = usePreferences((state) => state.boxMeasure);
    const setBoxMeasure = usePreferences((state) => state.setBoxMeasure);

    return [chosen ?? fallback, setBoxMeasure] as const;
}

// Escolha de medidas internas/externas e, ao lado, o que isso quer dizer (com ou sem a madeira).
export function BoxMeasureToggle({
    measure,
    onChange,
}: {
    measure: BoxMeasure;
    onChange: (measure: BoxMeasure) => void;
}) {
    const { t } = useTranslation('cutplan');

    return (
        <div className="flex flex-col gap-1">
            <SegmentedControl<BoxMeasure>
                label={t('config.measure')}
                size="sm"
                selected={measure}
                onChange={onChange}
                options={[
                    { id: 'internal', label: t('config.measureInternal') },
                    { id: 'external', label: t('config.measureExternal') },
                ]}
            />
            <p className="flex items-baseline gap-1.5 text-xs">
                <span className="font-medium text-foreground">
                    {t(
                        measure === 'internal'
                            ? 'config.internalTitle'
                            : 'config.externalTitle',
                    )}
                </span>
                <span className="text-muted">
                    ·{' '}
                    {t(
                        measure === 'internal'
                            ? 'config.internalTag'
                            : 'config.externalTag',
                    )}
                </span>
            </p>
        </div>
    );
}
