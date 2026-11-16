import { CircleAlert, CircleCheck } from 'lucide-react';
import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import type { ChamberCheck, VolumeCheck as VolumeCheckData } from '@/cutplan';
import { formatQuantity } from '@/lib/units/format';
import { defaultUnitFor, findUnit } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

const ROWS = [
    'internal',
    'braces',
    'drivers',
    'ports',
    'net',
    'simulated',
    'difference',
] as const;

type Row = (typeof ROWS)[number];

// Conferência de volume por câmara: o líquido do plano contra o da simulação.
export function VolumeCheck({ volume }: { volume: VolumeCheckData }) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unitId = defaultUnitFor('volume', unitSystem);
    const unit = findUnit(unitId);

    if (volume.chambers.length === 0) {
        return null;
    }

    const volumeText = (si: number | undefined) =>
        formatQuantity(si, unitId, locale);

    const cell = (row: Row, chamber: ChamberCheck): string => {
        switch (row) {
            case 'internal':
                return volumeText(chamber.internal_m3);
            case 'braces':
                return volumeText(chamber.braces_m3);
            case 'drivers':
                return volumeText(chamber.drivers_m3);
            case 'ports':
                return volumeText(chamber.ports_m3);
            case 'net':
                return volumeText(chamber.net_m3);
            case 'simulated':
                return volumeText(chamber.simulated_m3);
            case 'difference':
                return chamber.difference_ratio === undefined
                    ? '—'
                    : new Intl.NumberFormat(locale, {
                          style: 'percent',
                          maximumFractionDigits: 4,
                      }).format(chamber.difference_ratio);
        }
    };

    const Icon = volume.matchesSimulation === false ? CircleAlert : CircleCheck;

    return (
        <div className="flex flex-col gap-2">
            {/* Em telas estreitas a tabela rola na horizontal: a área recebe foco para rolar pelo
                teclado (como a tabela de resultados). */}
            <div
                role="region"
                aria-label={t('volume.caption', { unit: unit.symbol })}
                tabIndex={0}
                className="overflow-x-auto rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-solid"
            >
                <table className="w-full border-collapse text-left text-sm">
                    <caption className="pb-1.5 text-left text-xs font-semibold text-muted">
                        {t('volume.caption', { unit: unit.symbol })}
                    </caption>
                    <thead>
                        <tr className="border-b border-border text-xs text-muted">
                            <td />
                            {volume.chambers.map((chamber) => (
                                <th
                                    key={chamber.id}
                                    scope="col"
                                    className="px-2 py-1.5 text-right font-semibold whitespace-nowrap"
                                >
                                    {t(`volume.chambers.${chamber.id}`)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ROWS.map((row) => (
                            <tr
                                key={row}
                                className="border-b border-border last:border-b-0"
                            >
                                <th
                                    scope="row"
                                    className="px-2 py-1.5 font-semibold whitespace-nowrap"
                                >
                                    {t(`volume.rows.${row}`)}
                                </th>
                                {volume.chambers.map((chamber) => (
                                    <td
                                        key={chamber.id}
                                        className="px-2 py-1.5 text-right num whitespace-nowrap"
                                    >
                                        {cell(row, chamber)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {volume.matchesSimulation !== undefined && (
                <p
                    className={`flex items-center gap-1.5 text-xs ${volume.matchesSimulation ? 'text-status-ok' : 'text-status-error'}`}
                >
                    <Icon
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                        strokeWidth={2.5}
                    />
                    <span>
                        {t(
                            volume.matchesSimulation
                                ? 'volume.matches'
                                : 'volume.differs',
                        )}
                    </span>
                </p>
            )}
        </div>
    );
}
