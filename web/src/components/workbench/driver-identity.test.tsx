import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { useSavedDrivers } from '@/stores/saved-drivers';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { DriverIdentity } from './driver-identity';

const source = () => activeProjectStore().getState().data.driverSource;

describe('DriverIdentity', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        useSavedDrivers.setState({ items: [] });
    });

    test('mostra marca, modelo, variação e tipo sempre, mesmo sem driver escolhido', () => {
        renderWithProviders(<DriverIdentity />);

        for (const name of ['Marca', 'Modelo', /^Variação/]) {
            expect(screen.getByRole('textbox', { name })).toHaveValue('');
        }
        expect(screen.getByRole('button', { name: /Tipo/ })).toHaveTextContent(
            'Não informado',
        );
    });

    test('digitar grava no projeto; apagar tudo remove a identificação', async () => {
        renderWithProviders(<DriverIdentity />);

        await userEvent.type(
            screen.getByRole('textbox', { name: 'Marca' }),
            'Triton',
        );
        await userEvent.type(
            screen.getByRole('textbox', { name: 'Modelo' }),
            'TR 620',
        );

        expect(source()).toEqual({ brand: 'Triton', model: 'TR 620' });

        await userEvent.clear(screen.getByRole('textbox', { name: 'Marca' }));
        await userEvent.clear(screen.getByRole('textbox', { name: 'Modelo' }));

        expect(source()).toBeUndefined();
    });

    test('escolher o tipo grava e "Não informado" limpa', async () => {
        renderWithProviders(<DriverIdentity />);

        await userEvent.click(screen.getByRole('button', { name: /Tipo/ }));
        await userEvent.click(
            await screen.findByRole('option', { name: 'Subwoofer' }),
        );

        expect(source()).toEqual({ type: 'subwoofer' });
        expect(screen.getByRole('button', { name: /Tipo/ })).toHaveTextContent(
            'Subwoofer',
        );

        await userEvent.click(screen.getByRole('button', { name: /Tipo/ }));
        await userEvent.click(
            await screen.findByRole('option', { name: 'Não informado' }),
        );

        expect(source()).toBeUndefined();
    });

    test('reflete um driver copiado de fora e avisa o leitor de tela só então', async () => {
        renderWithProviders(<DriverIdentity />);

        act(() =>
            activeProjectStore().getState().applyCatalogDriver(
                { fs_hz: 32 },
                {
                    brand: 'Triton',
                    model: 'TR 620 12"',
                    variant: '4 Ω',
                    type: 'woofer',
                },
            ),
        );

        expect(screen.getByRole('textbox', { name: 'Marca' })).toHaveValue(
            'Triton',
        );
        expect(screen.getByRole('textbox', { name: /^Variação/ })).toHaveValue(
            '4',
        );
        expect(screen.getByRole('button', { name: /Tipo/ })).toHaveTextContent(
            'Woofer',
        );
        expect(
            screen.getByText('Driver aplicado: Triton TR 620 12" 4 Ω'),
        ).toBeInTheDocument();

        // Com o foco dentro do bloco (escrevendo), o aviso se cala.
        await userEvent.click(screen.getByRole('textbox', { name: 'Modelo' }));

        expect(screen.queryByText(/Driver aplicado/)).not.toBeInTheDocument();
    });

    test('avisa quando a identificação é a de um alto-falante da lista pessoal', () => {
        useSavedDrivers.getState().save({
            brand: 'Triton',
            model: 'TR 620',
            driver: { fs_hz: 32 },
        });
        renderWithProviders(<DriverIdentity />);

        expect(
            screen.queryByText('Dos meus alto-falantes'),
        ).not.toBeInTheDocument();

        act(() =>
            activeProjectStore()
                .getState()
                .setDriverIdentity({ brand: ' triton', model: 'TR 620' }),
        );

        expect(screen.getByText('Dos meus alto-falantes')).toBeVisible();
    });
});
