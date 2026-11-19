import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { useActiveProject } from '@/hooks/use-active-project';
import { simulationOf } from '@/hooks/use-simulation';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

type Chamber = 'main' | 'rear' | 'front';

// O que sobra do volume digitado depois de descontar alto-falante e duto: é o volume que a
// simulação usa, e muda a cada edição de duto, sintonia ou volume (como no BassBox).
export function VolumeBreakdown({ chamber = 'main' }: { chamber?: Chamber }) {
    const { t } = useTranslation('workbench');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const box = useActiveProject((state) => state.data.box);
    const results = useActiveProject(
        (state) => simulationOf(state.data).results,
    );
    const unit = defaultUnitFor('volume', unitSystem);

    const gross =
        chamber === 'rear'
            ? box.vr_m3
            : chamber === 'front'
              ? box.vf_m3
              : box.vb_m3;
    const net =
        chamber === 'rear'
            ? results.net_rear_m3
            : chamber === 'front'
              ? results.net_front_m3
              : results.net_volume_m3;
    // Duto em cada câmara: dutada e frontal sempre; traseira só na 6ª ordem; selada nenhum.
    const port =
        chamber === 'rear'
            ? box.type === 'bandpass6'
                ? results.port_rear_volume_m3
                : undefined
            : box.type === 'closed'
              ? undefined
              : results.port_volume_m3;

    if (gross === undefined || net === undefined || !Number.isFinite(net)) {
        return null;
    }

    const portVolume = port !== undefined && port > 0 ? port : 0;
    const driver = Math.max(0, gross - net - portVolume);
    const format = (si: number) => formatWithUnit(si, unit, locale);
    const parts = [
        driver > 1e-9
            ? t('volume.driver', { value: format(driver) })
            : undefined,
        portVolume > 1e-9
            ? t('volume.port', { value: format(portVolume) })
            : undefined,
    ].filter((part) => part !== undefined);

    return (
        <p
            aria-live="polite"
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-md bg-raised/60 px-2.5 py-1.5 text-xs"
        >
            <span>
                <span className="text-muted">
                    {t('volume.net')}
                    {chamber === 'main'
                        ? ''
                        : ` · ${t(`volume.${chamber}`)}`}{' '}
                </span>
                <span className="num font-semibold">
                    {net > 0 ? format(net) : '—'}
                </span>
            </span>
            {parts.length > 0 && (
                <span className="text-[11px] text-muted">
                    {parts.join(' · ')}
                </span>
            )}
        </p>
    );
}
