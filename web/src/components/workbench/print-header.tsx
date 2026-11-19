import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@/components/ui/brand-mark';
import { twoChambers } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { voiceCoils } from '@/lib/impedance';
import { PARAMETERS } from '@/lib/parameters';
import type { ParameterKey } from '@/lib/parameters';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

// Endereço público da aplicação, impresso no rodapé do cabeçalho para quem recebe a folha.
const SITE = 'buildbass.galarca.dev';

const DRIVER_KEYS: ParameterKey[] = [
    'fs_hz',
    'qts',
    'vas_m3',
    're_ohm',
    'xmax_m',
    'sd_m2',
    'pe_w',
];

// Cabeçalho da folha impressa: marca, título, data e os dados do alto-falante e da caixa que o
// plano usa, para a folha se explicar sozinha na marcenaria.
export function PrintHeader({ name }: { name: string }) {
    const { t } = useTranslation(['cutplan', 'workbench', 'common']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const data = useActiveProject((state) => state.data);
    const { driver, driverSource, drivers, box } = data;

    const value = (key: ParameterKey, si: number | undefined) => {
        if (si === undefined || !Number.isFinite(si)) {
            return '—';
        }

        const unit = defaultUnitFor(PARAMETERS[key].quantity, unitSystem);

        return formatWithUnit(si, unit, locale);
    };

    const identity = [driverSource?.brand, driverSource?.model]
        .filter((part) => part !== undefined && part !== '')
        .join(' ');
    const variant = driverSource?.variant;
    const dual = voiceCoils(variant) === 2;
    const exported = new Intl.DateTimeFormat(locale, {
        dateStyle: 'long',
        timeStyle: 'short',
    }).format(new Date());
    const volumeKeys: ParameterKey[] = twoChambers(box.type)
        ? ['vr_m3', 'vf_m3']
        : ['vb_m3'];
    const tuningKeys: ParameterKey[] =
        box.type === 'closed'
            ? []
            : box.type === 'bandpass6'
              ? ['fb_hz', 'fb_rear_hz']
              : ['fb_hz'];

    return (
        <header className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-6 border-b-2 border-black pb-3">
                <div className="flex items-center gap-3">
                    <BrandMark className="size-11 [print-color-adjust:exact]" />
                    <div className="flex flex-col">
                        <span className="text-xl leading-tight font-extrabold tracking-tight">
                            {t('common:appName')}
                        </span>
                        <span className="text-[11px] tracking-wide text-muted uppercase">
                            {t('cutplan:print.subtitle')}
                        </span>
                    </div>
                </div>
                <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-right text-[11px]">
                    <dt className="text-muted">
                        {t('cutplan:print.exportedAt')}
                    </dt>
                    <dd className="num">{exported}</dd>
                    <dt className="text-muted">{t('cutplan:print.site')}</dt>
                    <dd>{SITE}</dd>
                </dl>
            </div>

            <h1 className="text-xl font-bold">
                {t('cutplan:print.title', { name })}
            </h1>

            <div className="grid grid-cols-2 gap-4">
                <section className="rounded border border-border p-3">
                    <h2 className="mb-2 text-xs font-semibold tracking-wide uppercase">
                        {t('cutplan:print.driver')}
                    </h2>
                    <p className="text-sm font-semibold">
                        {identity === ''
                            ? t('cutplan:print.unnamedDriver')
                            : identity}
                    </p>
                    <p className="mb-2 text-xs text-muted">
                        {[
                            variant !== undefined && variant !== ''
                                ? `${variant} · ${t(dual ? 'common:impedance.dual' : 'common:impedance.single')}`
                                : undefined,
                            t('cutplan:print.count', { count: drivers.count }),
                            drivers.count > 1
                                ? t(`workbench:drivers.${drivers.wiring}`)
                                : undefined,
                        ]
                            .filter((part) => part !== undefined)
                            .join(' · ')}
                    </p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
                        {DRIVER_KEYS.flatMap((key) => {
                            const si = driver[key as keyof typeof driver] as
                                | number
                                | undefined;

                            // Parâmetro não informado fica de fora, em vez de um traço solto.
                            return si === undefined
                                ? []
                                : [
                                      <Row
                                          key={key}
                                          label={PARAMETERS[key].symbol}
                                          value={value(key, si)}
                                      />,
                                  ];
                        })}
                    </dl>
                </section>

                <section className="rounded border border-border p-3">
                    <h2 className="mb-2 text-xs font-semibold tracking-wide uppercase">
                        {t('cutplan:print.box')}
                    </h2>
                    <p className="mb-2 text-sm font-semibold">
                        {t(`workbench:boxType.${box.type}`)}
                    </p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs">
                        {[...volumeKeys, ...tuningKeys].map((key) => (
                            <Row
                                key={key}
                                label={PARAMETERS[key].symbol}
                                value={value(
                                    key,
                                    box[key as keyof typeof box] as
                                        | number
                                        | undefined,
                                )}
                            />
                        ))}
                    </dl>
                </section>
            </div>
        </header>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <>
            <dt className="text-muted">{label}</dt>
            <dd className="num">{value}</dd>
        </>
    );
}
