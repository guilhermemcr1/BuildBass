import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { simulate } from '@/engine';
import { ESSENTIAL_DRIVER_PARAMETERS, PARAMETERS } from '@/lib/parameters';
import { useExpanded } from '@/stores/expanded';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { DriverPanel } from './driver-panel';
import { ModeSwitch } from './mode-switch';
import { PlanConfig } from './plan-config';

function Both() {
    return (
        <>
            <ModeSwitch />
            <DriverPanel onSubmitDriver={() => undefined} />
            <PlanConfig />
        </>
    );
}

function symbols() {
    return screen
        .getAllByRole('textbox')
        .map((box) => box.getAttribute('aria-label') ?? '');
}

function driverField(symbol: string) {
    return screen.queryByRole('textbox', {
        name: new RegExp(`^${symbol}\\s?—`),
    });
}

describe('ModeSwitch e "Mostrar mais"', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ mode: 'normal' });
        useExpanded.getState().collapseAll();
    });

    test('Normal mostra só os essenciais do driver e esconde os avançados', () => {
        renderWithProviders(<Both />);

        for (const key of ESSENTIAL_DRIVER_PARAMETERS) {
            expect(driverField(PARAMETERS[key].symbol)).toBeInTheDocument();
        }
        for (const symbol of ['Qes', 'Qms', 'Re', 'Le', 'Bl', 'Mms', 'Vd']) {
            expect(driverField(symbol)).not.toBeInTheDocument();
        }
        expect(
            screen.getAllByRole('button', { name: 'Mostrar mais' }),
        ).toHaveLength(2);
    });

    test('Pro expande o driver e o plano sem outro clique; Normal recolhe os dois', async () => {
        renderWithProviders(<Both />);
        const pro = screen.getByRole('switch', { name: 'Modo Pro' });

        await userEvent.click(pro);

        expect(driverField('Qes')).toBeInTheDocument();
        expect(driverField('Re')).toBeInTheDocument();
        expect(
            screen.getByRole('textbox', { name: /^Ps\s?—/ }),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Mostrar mais' }),
        ).not.toBeInTheDocument();
        expect(usePreferences.getState().mode).toBe('pro');

        await userEvent.click(pro);
        expect(pro).not.toBeChecked();

        expect(driverField('Qes')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('textbox', { name: /^Ps\s?—/ }),
        ).not.toBeInTheDocument();
    });

    test('abrir um "Mostrar mais" à mão não mexe no outro nem no modo', async () => {
        renderWithProviders(<Both />);

        await userEvent.click(
            screen.getAllByRole('button', { name: 'Mostrar mais' })[0],
        );

        expect(driverField('Qes')).toBeInTheDocument();
        expect(
            screen.queryByRole('textbox', { name: /^Ps\s?—/ }),
        ).not.toBeInTheDocument();
        expect(usePreferences.getState().mode).toBe('normal');
    });

    test('valor em campo recolhido continua valendo e o resultado não muda ao alternar', async () => {
        renderWithProviders(<Both />);
        act(() => {
            const project = activeProjectStore().getState();
            project.setDriverValue('fs_hz', 28);
            project.setDriverValue('qts', 0.38);
            project.setDriverValue('vas_m3', 0.085);
            project.setDriverValue('re_ohm', 3.6);
            project.setBoxValue('vb_m3', 0.06);
            project.setBoxValue('fb_hz', 32);
        });
        const run = () => simulate(activeProjectStore().getState().data);
        const before = run();

        // Re está recolhido, mas o botão avisa que há 1 campo preenchido lá dentro.
        expect(
            screen.getAllByRole('button', {
                name: 'Mostrar mais (1 preenchido)',
            })[0],
        ).toBeVisible();

        await userEvent.click(screen.getByRole('switch', { name: 'Modo Pro' }));
        await userEvent.click(screen.getByRole('switch', { name: 'Modo Pro' }));

        expect(activeProjectStore().getState().data.driver.re_ohm).toBe(3.6);
        expect(run()).toEqual(before);
    });

    test('no Normal há pelo menos 30 % menos campos que no Pro', async () => {
        renderWithProviders(<Both />);
        const normal = symbols().length;

        await userEvent.click(screen.getByRole('switch', { name: 'Modo Pro' }));
        const pro = symbols().length;

        expect(normal).toBeLessThanOrEqual(pro * 0.7);
    });
});
