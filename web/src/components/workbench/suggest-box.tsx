import { Sparkles } from 'lucide-react';
import { useId, useState } from 'react';
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

// Sugere Vb (e Fb) pelos alinhamentos clássicos numa só etapa de desfazer (FR-019).
export function SuggestBox() {
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
            suggestion.alignment === 'keele'
                ? t('engine:alignments.keele', {
                      vb,
                      fb: formatWithUnit(suggestion.fb_hz ?? 0, 'Hz', locale),
                  })
                : t('engine:alignments.butterworth2', { vb });
        setMessage(`${text} ${t('engine:alignments.grossNote')}`);
    };

    return (
        <div className="flex flex-col gap-2">
            <Button
                onPress={suggest}
                disabled={reason !== undefined}
                aria-describedby={reason === undefined ? undefined : reasonId}
                className="self-start"
            >
                <Sparkles aria-hidden="true" className="size-4" />
                {t('suggest.button')}
            </Button>
            {reason !== undefined && (
                <p id={reasonId} className="text-[11px] text-muted">
                    {reason}
                </p>
            )}
            {message !== null && <Banner>{message}</Banner>}
        </div>
    );
}
