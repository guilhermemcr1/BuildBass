import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vite-plus/test';
import { renderWithProviders } from '@/test/render';
import { ImpedanceField } from './impedance-field';

function Harness({
    initial = '',
    onValue,
}: {
    initial?: string;
    onValue?: (value: string) => void;
}) {
    const [value, setValue] = useState(initial);

    return (
        <ImpedanceField
            label="Variação"
            value={value}
            onChange={(next) => {
                setValue(next);
                onValue?.(next);
            }}
        />
    );
}

describe('ImpedanceField', () => {
    test('só o número: letras e o Ω digitados são barrados, e o valor guardado é "N Ω"', async () => {
        const onValue = vi.fn();
        renderWithProviders(<Harness onValue={onValue} />);
        const input = screen.getByRole('textbox', { name: 'Variação' });

        await userEvent.type(input, 'Dual 4 Ω');

        expect(input).toHaveValue('4');
        expect(onValue).toHaveBeenLastCalledWith('4 Ω');
    });

    test('mostra o Ω fixo ao lado e aceita vírgula nos decimais', async () => {
        const onValue = vi.fn();
        renderWithProviders(<Harness onValue={onValue} />);

        await userEvent.type(
            screen.getByRole('textbox', { name: 'Variação' }),
            '3,2',
        );

        expect(screen.getByText('Ω')).toBeInTheDocument();
        expect(onValue).toHaveBeenLastCalledWith('3.2 Ω');
    });

    test('um valor guardado "4 Ω" aparece como "4"', () => {
        renderWithProviders(<Harness initial="4 Ω" />);

        expect(screen.getByRole('textbox', { name: 'Variação' })).toHaveValue(
            '4',
        );
    });

    test('texto antigo fora do padrão aparece como está e é apontado', () => {
        renderWithProviders(<Harness initial="Dual 4" />);

        expect(screen.getByRole('textbox', { name: 'Variação' })).toHaveValue(
            'Dual 4',
        );
        expect(
            screen.getByText(/Informe só a impedância em ohms/),
        ).toBeInTheDocument();
    });

    test('fora da faixa é apontado ao sair do campo', async () => {
        renderWithProviders(<Harness />);

        await userEvent.type(
            screen.getByRole('textbox', { name: 'Variação' }),
            '900',
        );
        await userEvent.tab();

        expect(
            screen.getByText(/Informe só a impedância em ohms/),
        ).toBeInTheDocument();
    });

    test('bobina dupla pela caixa: guarda "N+N Ω" e mostra só o número', async () => {
        const onValue = vi.fn();
        renderWithProviders(<Harness onValue={onValue} />);
        const input = screen.getByRole('textbox', { name: 'Variação' });

        await userEvent.type(input, '4+4');
        expect(input).toHaveValue('44');
        await userEvent.clear(input);
        await userEvent.type(input, '4');
        await userEvent.click(
            screen.getByRole('radio', { name: 'Bobina dupla' }),
        );

        expect(onValue).toHaveBeenLastCalledWith('4+4 Ω');
        expect(input).toHaveValue('4');
    });

    test('caixa marcada antes do número já vale ao digitar; desmarcar volta a uma bobina', async () => {
        const onValue = vi.fn();
        renderWithProviders(<Harness onValue={onValue} />);
        const box = screen.getByRole('radio', { name: 'Bobina dupla' });

        await userEvent.click(box);
        await userEvent.type(
            screen.getByRole('textbox', { name: 'Variação' }),
            '2',
        );
        expect(onValue).toHaveBeenLastCalledWith('2+2 Ω');

        await userEvent.click(
            screen.getByRole('radio', { name: 'Bobina simples' }),
        );
        expect(onValue).toHaveBeenLastCalledWith('2 Ω');
    });

    test('um valor guardado "4+4 Ω" aparece como "4" com a caixa marcada', () => {
        renderWithProviders(<Harness initial="4+4 Ω" />);

        expect(screen.getByRole('textbox', { name: 'Variação' })).toHaveValue(
            '4',
        );
        expect(
            screen.getByRole('radio', { name: 'Bobina dupla' }),
        ).toBeChecked();
    });
});
