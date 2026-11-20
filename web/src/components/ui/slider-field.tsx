import type { ComponentProps } from 'react';
import { Slider, SliderThumb, SliderTrack } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ParameterField } from './parameter-field';

type SliderFieldProps = ComponentProps<typeof ParameterField> & {
    minSi: number;
    maxSi: number;
    scale: 'linear' | 'log';
};

const STEPS = 1000;

function toPosition(
    si: number,
    min: number,
    max: number,
    scale: 'linear' | 'log',
): number {
    const clamped = Math.min(Math.max(si, min), max);
    const ratio =
        scale === 'log'
            ? Math.log(clamped / min) / Math.log(max / min)
            : (clamped - min) / (max - min);

    return Math.round(ratio * STEPS);
}

function fromPosition(
    position: number,
    min: number,
    max: number,
    scale: 'linear' | 'log',
): number {
    const ratio = position / STEPS;

    return scale === 'log'
        ? min * (max / min) ** ratio
        : min + ratio * (max - min);
}

// Campo numérico com slider vinculado: os dois editam o mesmo valor SI.
export function SliderField({
    minSi,
    maxSi,
    scale,
    ...field
}: SliderFieldProps) {
    const { t } = useTranslation('parameters');
    const position =
        field.valueSi === undefined
            ? 0
            : toPosition(field.valueSi, minSi, maxSi, scale);

    return (
        // Na largura do campo (símbolo + caixa de até 11 rem): o trilho não atravessa a coluna.
        <div className="flex w-full max-w-57 flex-col gap-2">
            <ParameterField {...field} />
            <Slider
                aria-label={t(`${field.parameter}.label`)}
                minValue={0}
                maxValue={STEPS}
                value={position}
                onChange={(next) =>
                    field.onChangeSi(fromPosition(next, minSi, maxSi, scale))
                }
                className="px-2"
            >
                {({ state }) => (
                    <SliderTrack className="relative h-5 w-full before:absolute before:top-1/2 before:h-1 before:w-full before:-translate-y-1/2 before:rounded-full before:bg-border">
                        <div
                            aria-hidden="true"
                            className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-accent"
                            style={{ width: `${state.getThumbPercent(0) * 100}%` }}
                        />
                        <SliderThumb className="top-1/2 size-3.5 rounded-full border-2 border-accent bg-surface shadow-sm outline-none motion-safe:transition-transform data-[dragging]:scale-125 data-[dragging]:bg-accent data-[hovered]:scale-110 data-[focus-visible]:outline-2 data-[focus-visible]:outline-solid data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-accent" />
                    </SliderTrack>
                )}
            </Slider>
        </div>
    );
}
