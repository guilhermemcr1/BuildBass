import { Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Banner } from '@/components/ui/banner';
import { Button } from '@/components/ui/button';
import { deriveDriver, suggestBox, twoChambers } from '@/engine';
import type { DriverKey } from '@/engine';
import { useActiveProject } from '@/hooks/use-active-project';
import { PARAMETERS } from '@/lib/parameters';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

const NEEDS: DriverKey[] = ['fs_hz', 'qts', 'vas_m3'];

type SuggestBoxProps = {
    title: string;
    // Os campos do grupo (volume, sintonia, perdas); a sugestão preenche alguns deles.
    children: ReactNode;
};

// Grupo "Volume e sintonia": título com o botão que sugere Vb (e Fb) pelos alinhamentos clássicos
// numa só etapa de desfazer (FR-019), os campos logo abaixo e o motivo ou resultado depois deles.
export function SuggestBox({ title, children }: SuggestBoxProps) {
    const { t } = useTranslation(['workbench', 'engine']);
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const data = useActiveProject((state) => state.data);
    const apply = useActiveProject((state) => state.apply);
    const [message, setMessage] = useState<string | null>(null);
    const reasonId = useId();
    const { values } = deriveDriver(data.driver);
    const missing = NEEDS.filter((key) => values[key].value === undefined);
    const listFormat = new Intl.ListFormat(locale, {
        style: 'long',
        type: 'conjunction',
    });
    const missingReason =
        missing.length === 0
            ? undefined
            : t('suggest.needs', {
                  missing: listFormat.format(
                      missing.map((key) => PARAMETERS[key].symbol),
                  ),
              });
    // Não há alinhamento clássico de bandpass nesta versão (specs/004, Assumptions).
    const reason = twoChambers(data.box.type)
        ? t('suggest.bandpassUnavailable')
        : missingReason;

    const suggest = () => {
        const suggestion = suggestBox(data);
        const qts = new Intl.NumberFormat(locale, {
            maximumFractionDigits: 2,
        }).format(values.qts.value ?? 0);

        if (!suggestion.ok) {
            if (suggestion.reason === 'missing') {
                return;
            }

            if (suggestion.reason === 'portTooLarge') {
                const areaUnit = defaultUnitFor('area', unitSystem);
                setMessage(
                    t('engine:alignments.portTooLarge', {
                        fb: formatWithUnit(suggestion.fb_hz, 'Hz', locale),
                        area: formatWithUnit(
                            suggestion.port_area_m2,
                            areaUnit,
                            locale,
                        ),
                        max: formatWithUnit(
                            suggestion.max_port_area_m2,
                            areaUnit,
                            locale,
                        ),
                    }),
                );

                return;
            }

            setMessage(
                suggestion.reason === 'qtsTooLow'
                    ? t('engine:alignments.qtsTooLow', { qts })
                    : data.box.type === 'closed'
                      ? t('engine:alignments.closedQtsTooHigh', { qts })
                      : t('engine:alignments.ventedQtsTooHigh', { qts }),
            );

            return;
        }

        apply((current) => ({
            ...current,
            box: {
                ...current.box,
                vb_m3: suggestion.vb_m3,
                ...(suggestion.fb_hz === undefined
                    ? {}
                    : { fb_hz: suggestion.fb_hz }),
            },
        }));

        const volumeUnit =
            data.fieldUnits.vb_m3 ?? defaultUnitFor('volume', unitSystem);
        const vb = formatWithUnit(suggestion.vb_m3, volumeUnit, locale);
        const text =
            suggestion.alignment === 'butterworth2'
                ? t('engine:alignments.butterworth2', { vb })
                : t('engine:alignments.vented', {
                      name: t(`engine:alignments.name_${suggestion.alignment}`),
                      ql: new Intl.NumberFormat(locale).format(
                          suggestion.ql ?? 7,
                      ),
                      vb,
                      fb: formatWithUnit(suggestion.fb_hz ?? 0, 'Hz', locale),
                      keeleVb: formatWithUnit(
                          suggestion.keele?.vb_m3 ?? 0,
                          volumeUnit,
                          locale,
                      ),
                      keeleFb: formatWithUnit(
                          suggestion.keele?.fb_hz ?? 0,
                          'Hz',
                          locale,
                      ),
                  });
        setMessage(`${text} ${t('engine:alignments.grossNote')}`);
    };

    return (
        <section aria-label={title} className="flex flex-col gap-2.5">
            <header className="flex min-h-8 items-center justify-between gap-2">
                <h3 className="text-section">{title}</h3>
                <Button
                    variant="quiet"
                    onPress={suggest}
                    disabled={reason !== undefined}
                    aria-describedby={
                        reason === undefined ? undefined : reasonId
                    }
                >
                    <Sparkles aria-hidden="true" className="size-4" />
                    {t('suggest.button')}
                </Button>
            </header>
            {children}
            {reason !== undefined && (
                <p id={reasonId} className="text-[11px] text-muted">
                    {reason}
                </p>
            )}
            {message !== null && <Banner>{message}</Banner>}
        </section>
    );
}
