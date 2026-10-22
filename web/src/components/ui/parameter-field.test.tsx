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
    onChangeSi?: (si: number | undefined) => void;
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

    test('passar pelo campo sem editar não troca o valor exato pelo arredondado', async () => {
        const onChangeSi = vi.fn();
        renderWithProviders(
            <Harness
                parameter="qts"
                initialSi={0.380973}
                initialUnit="none"
                onChangeSi={onChangeSi}
            />,
        );

        await userEvent.click(screen.getByRole('textbox'));
        await userEvent.tab();

        expect(screen.getByRole('textbox')).toHaveValue('0,38');
        expect(onChangeSi).not.toHaveBeenCalled();
    });

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
            screen.getByRole('button', { name: /trocar unidade de Vas/ }),
        );
        await userEvent.click(screen.getByRole('menuitemradio', { name: 'ft³' }));

        expect(screen.getByRole('textbox')).toHaveValue('3,00');

        await userEvent.click(
            screen.getByRole('button', { name: /trocar unidade de Vas/ }),
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

    test('focar o campo não faz a ajuda aparecer no fluxo (não expande o campo)', async () => {
        const { container } = renderWithProviders(
            <Harness parameter="fs_hz" initialUnit="Hz" />,
        );
        const description = container.querySelector('[slot="description"]');

        expect(description).toHaveClass('sr-only');

        await userEvent.click(screen.getByRole('textbox'));

        expect(screen.getByRole('textbox')).toHaveFocus();
        expect(container.querySelector('[slot="description"]')).toHaveClass(
            'sr-only',
        );
        expect(container.querySelector('[slot="description"]')?.className)
            .not.toMatch(/not-sr-only/);
    });

    test('a explicação aparece como tooltip ao focar o campo numérico', async () => {
        renderWithProviders(<Harness parameter="fs_hz" initialUnit="Hz" />);

        await userEvent.tab();

        expect(screen.getByRole('textbox')).toHaveFocus();
        expect(await screen.findByRole('tooltip')).toHaveTextContent(
            'Frequência em que o cone ressoa livre no ar, sem caixa.',
        );
    });

    test('a explicação aparece no tooltip do símbolo ao pairar o mouse', async () => {
        renderWithProviders(<Harness parameter="fs_hz" initialUnit="Hz" />);
        const user = userEvent.setup();

        await user.pointer({ target: document.body });
        await user.pointer({ target: screen.getByText('Fs') });

        expect(await screen.findByRole('tooltip')).toHaveTextContent(
            'Frequência em que o cone ressoa livre no ar, sem caixa.',
        );
    });

    test('o status usa a versão compacta (ícone e texto curto)', () => {
        renderWithProviders(
            <ParameterField
                parameter="fs_hz"
                valueSi={28}
                unit="Hz"
                onChangeSi={() => undefined}
                status="warn"
            />,
        );

        expect(
            screen.getByText('Atenção', { selector: ':not(.sr-only)' }),
        ).toBeVisible();
    });

    test('sem verificação não ocupa linha: só OK, atenção e erro aparecem', () => {
        renderWithProviders(
            <ParameterField
                parameter="fs_hz"
                valueSi={28}
                unit="Hz"
                onChangeSi={() => undefined}
                status="unchecked"
            />,
        );

        expect(screen.queryByText('Sem verif.')).toBeNull();
        expect(screen.queryByText('Sem verificação')).toBeNull();
    });
});
