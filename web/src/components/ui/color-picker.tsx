import { Check } from 'lucide-react';
import { Radio, RadioGroup } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { SWATCH } from '@/components/workbench/swatch';
import { SERIES_COLORS } from '@/lib/project/types';
import type { SeriesColor } from '@/lib/project/types';
import { cn } from '@/lib/utils';

type ColorPickerProps = {
    value: SeriesColor;
    onChange: (color: SeriesColor) => void;
};

// Paleta de seis cores (tokens --series-N). A cor ativa leva um visto além da cor.
export function ColorPicker({ value, onChange }: ColorPickerProps) {
    const { t } = useTranslation('project');

    return (
        <RadioGroup
            aria-label={t('tabs.color')}
            orientation="horizontal"
            value={String(value)}
            onChange={(next) => onChange(Number(next) as SeriesColor)}
            className="flex gap-1.5"
        >
            {SERIES_COLORS.map((color) => (
                <Radio
                    key={color}
                    value={String(color)}
                    aria-label={t('tabs.colorOption', { n: color })}
                    className={cn(
                        'flex size-7 cursor-default items-center justify-center rounded-full border border-transparent outline-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent data-[focus-visible]:outline-solid data-[selected]:border-foreground',
                        SWATCH[color],
                    )}
                >
                    {({ isSelected }) =>
                        isSelected ? (
                            <Check
                                aria-hidden="true"
                                className="size-4 text-surface"
                            />
                        ) : null
                    }
                </Radio>
            ))}
        </RadioGroup>
    );
}
