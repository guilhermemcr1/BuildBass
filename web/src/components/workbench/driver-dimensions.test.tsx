import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { useExpanded } from '@/stores/expanded';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { DriverDimensions } from './driver-dimensions';

const data = () => activeProjectStore().getState().data;
const field = (name: RegExp) => screen.getByRole('textbox', { name });

describe('DriverDimensions', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
        act(() => useExpanded.getState().expand('driverDims'));
    });

    test('mostra o formato, o pistão e as medidas A, B, C, E, F, G e M-Vd', () => {
        renderWithProviders(<DriverDimensions />);

        expect(screen.getByRole('button', { name: /Formato/ })).toBeVisible();
        expect(
            screen.getByRole('button', { name: /Tipo de pistão/ }),
        ).toBeVisible();

        for (const name of [
            /^A —/,
            /^B —/,
            /^C —|recorte/,
            /^E —/,
            /^F —/,
            /^G —/,
            /M-Vd/,
        ]) {
            expect(field(name)).toBeVisible();
        }

        expect(screen.queryByRole('textbox', { name: /^D —/ })).toBeNull();
    });

    test('digitar em mm guarda a medida em metros no projeto', async () => {
        renderWithProviders(<DriverDimensions />);

        await userEvent.type(field(/^A —/), '308');
        await userEvent.tab();
        await userEvent.type(field(/^G —/), '160');
        await userEvent.tab();

        expect(data().driverDims).toEqual({ a_m: 0.308, g_m: 0.16 });
    });

    test('o recorte C é o mesmo campo do plano de corte e o M-Vd é o volume do driver', async () => {
        renderWithProviders(<DriverDimensions />);

        await userEvent.type(field(/recorte/), '283');
        await userEvent.tab();
        await userEvent.type(field(/M-Vd/), '2');
        await userEvent.tab();

        expect(data().cutPlan?.cutout_m).toBeCloseTo(0.283);
        expect(data().driver.vd_m3).toBeCloseTo(0.002);
    });

    test('formato retangular mostra a medida D', async () => {
        renderWithProviders(<DriverDimensions />);

        await userEvent.click(screen.getByRole('button', { name: /Formato/ }));
        await userEvent.click(
            await screen.findByRole('option', { name: 'Retangular' }),
        );

        expect(data().driverDims?.shape).toBe('rect');
        expect(field(/^D —/)).toBeVisible();
    });

    test('valor fora da faixa não entra no projeto e explica o limite', async () => {
        renderWithProviders(<DriverDimensions />);

        await userEvent.type(field(/^G —/), '5000');
        await userEvent.tab();

        expect(data().driverDims).toBeUndefined();
        expect(screen.getByText(/Fora da faixa aceita/)).toBeInTheDocument();
    });
});
