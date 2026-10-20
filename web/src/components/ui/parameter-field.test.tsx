import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vite-plus/test';
import type { Locale } from '@/i18n';
import type { ParameterKey } from '@/lib/parameters';
import type { UnitId } from '@/lib/units/quantities';
import { renderWithProviders } from '@/test/render';
import { ParameterField } from './parameter-field';

type HarnessProps = {
    parameter: ParameterKey;
    initialSi?: number;
    initialUnit: UnitId;
    onChangeSi?: (si: number) => void;
};

function Harness({
    parameter,
    initialSi,
    initialUnit,
    onChangeSi,
}: HarnessProps) {
    const [valueSi, setValueSi] = useState(initialSi);
    const [unit, setUnit] = useState(initialUnit);

    return (
        <ParameterField
            parameter={parameter}
            valueSi={valueSi}
            unit={unit}
            onUnitChange={setUnit}
            onChangeSi={(si) => {
                setValueSi(si);
                onChangeSi?.(si);
            }}
        />
    );
}

async function typeInto(input: HTMLElement, text: string) {
    await userEvent.clear(input);
    await userEvent.type(input, text);
    await userEvent.tab();
}

describe('ParameterField', () => {
    test.each([
        ['pt-BR', '28,5'],
        ['en', '28.5'],
    ] as [Locale, string][])(
        'em %s aceita %s como 28,5 Hz',
        async (locale, typed) => {
            const onChangeSi = vi.fn();
            renderWithProviders(
                <Harness
                    parameter="fs_hz"
                    initialUnit="Hz"
                    onChangeSi={onChangeSi}
                />,
                locale,
            );

            await typeInto(screen.getByRole('textbox'), typed);

            expect(onChangeSi).toHaveBeenLastCalledWith(28.5);
        },
    );

    test('valor fora da faixa mostra erro com texto e mantém o anterior', async () => {
        const onChangeSi = vi.fn();
        renderWithProviders(
            <Harness
                parameter="fs_hz"
                initialSi={28}
                initialUnit="Hz"
                onChangeSi={onChangeSi}
            />,
        );
        const input = screen.getByRole('textbox');

        await typeInto(input, '-5');

        expect(onChangeSi).not.toHaveBeenCalled();
        expect(input).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText(/Fora da faixa aceita/)).toBeInTheDocument();
        expect(input).toHaveValue('28,0');
    });

    test('colar 1.234,5 em pt-BR resulta em 1234,5', async () => {
        const onChangeSi = vi.fn();
        renderWithProviders(
            <Harness
                parameter="fs_hz"
                initialUnit="Hz"
                onChangeSi={onChangeSi}
            />,
        );
        const input = screen.getByRole('textbox');

        await userEvent.click(input);
        await userEvent.paste('1.234,5');
        await userEvent.tab();

        expect(onChangeSi).toHaveBeenLastCalledWith(1234.5);
    });

    test('trocar a unidade muda só a exibição, não o valor SI', async () => {
        const onChangeSi = vi.fn();
        renderWithProviders(
            <Harness
                parameter="vas_m3"
                initialSi={0.085}
                initialUnit="L"
                onChangeSi={onChangeSi}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Trocar unidade de Vas' }),
        );
        await userEvent.click(screen.getByRole('menuitemradio', { name: 'ft³' }));

        expect(screen.getByRole('textbox')).toHaveValue('3,00');

        await userEvent.click(
            screen.getByRole('button', { name: 'Trocar unidade de Vas' }),
        );
        await userEvent.click(screen.getByRole('menuitemradio', { name: 'L' }));

        expect(screen.getByRole('textbox')).toHaveValue('85,0');
        expect(onChangeSi).not.toHaveBeenCalled();
    });

    test('a explicação do parâmetro é a descrição acessível do campo', () => {
        renderWithProviders(<Harness parameter="fs_hz" initialUnit="Hz" />);

        expect(screen.getByRole('textbox')).toHaveAccessibleDescription(
            'Frequência em que o cone ressoa livre no ar, sem caixa.',
        );
    });
});
