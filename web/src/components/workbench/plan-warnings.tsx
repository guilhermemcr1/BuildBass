import { useLocale } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { StatusIndicator } from '@/components/ui/status-indicator';
import type { FieldStatus } from '@/components/ui/status-indicator';
import type { Plan, PlanWarning } from '@/cutplan';
import { cutoutName, pieceName, planKeySymbol } from '@/lib/cut-plan-text';
import { formatWithUnit } from '@/lib/units/format';
import { defaultUnitFor } from '@/lib/units/quantities';
import { usePreferences } from '@/stores/preferences';

const TONE: Record<PlanWarning['tone'], FieldStatus> = {
    error: 'error',
    warn: 'warn',
    info: 'unchecked',
};

const ORDER: Record<PlanWarning['tone'], number> = {
    error: 0,
    warn: 1,
    info: 2,
};

// Avisos do plano com ícone, cor e texto, do mais grave ao informativo (FR-009, FR-010).
export function PlanWarnings({ plan }: { plan: Plan }) {
    const { t } = useTranslation('cutplan');
    const { locale } = useLocale();
    const unitSystem = usePreferences((state) => state.unitSystem);
    const unit = defaultUnitFor('length', unitSystem);
    const length = (si: number) => formatWithUnit(si, unit, locale);

    if (plan.warnings.length === 0) {
        return null;
    }

    const sorted = [...plan.warnings].sort(
        (a, b) => ORDER[a.tone] - ORDER[b.tone],
    );

    return (
        <ul className="flex flex-col gap-1.5" aria-label={t('warnings.title')}>
            {sorted.map((warning) => {
                const text = t(`warnings.${warning.id}`, {
                    // Na bandpass de 6ª ordem o aviso nomeia o duto (`<aviso>_rear` / `_front`).
                    context: warning.duct,
                    // O nome da peça entra em minúscula no meio da frase.
                    piece:
                        warning.piece === undefined
                            ? ''
                            : pieceName(warning.piece, t).toLowerCase(),
                    field:
                        warning.key === undefined
                            ? ''
                            : planKeySymbol(warning.key, t),
                    cutout:
                        warning.cutout === undefined
                            ? ''
                            : cutoutName(warning.cutout, t),
                    thickness: length(plan.thickness_m),
                    length: length(warning.length_m ?? plan.port_length_m ?? 0),
                    depth: length(
                        warning.depth_m ??
                            plan.dimensions.chambers?.front_d_m ??
                            plan.dimensions.internal.d_m,
                    ),
                });

                return (
                    <li
                        key={`${warning.id}-${warning.piece ?? ''}-${warning.duct ?? ''}-${warning.cutout === undefined ? '' : `${warning.cutout.kind}${warning.cutout.n}`}`}
                        className="flex items-start"
                    >
                        <StatusIndicator
                            status={TONE[warning.tone]}
                            label={text}
                            className="items-start text-sm [&>svg]:mt-0.5"
                        />
                    </li>
                );
            })}
        </ul>
    );
}
