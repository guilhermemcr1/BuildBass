import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import type { BoxType } from '@/lib/project/types';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { BoxPanel } from './box-panel';

function boxType(type: BoxType) {
    act(() => activeProjectStore().getState().setBoxType(type));
}

describe('BoxPanel — tipos de caixa', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('o seletor tem os três tipos, todos ativos, e não avisa que a bandpass não existe', () => {
        renderWithProviders(<BoxPanel />);

        for (const name of ['Selada', 'Dutada', 'Bandpass']) {
            expect(screen.getByRole('radio', { name })).not.toBeDisabled();
        }

        expect(screen.queryByText(/chega numa próxima versão/)).toBeNull();
    });

    test('selada mostra só Vb e Ql', () => {
        boxType('closed');
        renderWithProviders(<BoxPanel />);

        expect(screen.getAllByRole('textbox', { name: /^Vb/ })).toHaveLength(1);
        expect(screen.queryByRole('textbox', { name: /^Fb/ })).toBeNull();
        expect(screen.queryByRole('textbox', { name: /^Vr/ })).toBeNull();
        expect(screen.queryByText('Duto')).toBeNull();
    });

    test('dutada mostra Vb, Fb, Ql e o duto', () => {
        boxType('vented');
        renderWithProviders(<BoxPanel />);

        expect(screen.getByRole('textbox', { name: /^Vb/ })).toBeVisible();
        expect(screen.getByRole('textbox', { name: /^Fb/ })).toBeVisible();
        expect(screen.getByText('Duto')).toBeVisible();
        expect(screen.queryByRole('textbox', { name: /^Vr/ })).toBeNull();
    });

    test('bandpass mostra as duas câmaras, Fb, Ql e o duto da câmara frontal', () => {
        boxType('bandpass');
        renderWithProviders(<BoxPanel />);

        expect(screen.getByRole('textbox', { name: /^Vr/ })).toBeVisible();
        expect(screen.getByRole('textbox', { name: /^Vf/ })).toBeVisible();
        expect(screen.getByRole('textbox', { name: /^Fb/ })).toBeVisible();
        expect(screen.getByRole('textbox', { name: /^Ql/ })).toBeVisible();
        expect(screen.getByText('Duto (câmara frontal)')).toBeVisible();
        expect(screen.queryByRole('textbox', { name: /^Vb/ })).toBeNull();
    });

    test('escolher Bandpass muda o tipo do projeto ativo', async () => {
        renderWithProviders(<BoxPanel />);

        await userEvent.click(screen.getByRole('radio', { name: 'Bandpass' }));

        expect(activeProjectStore().getState().data.box.type).toBe('bandpass');
    });

    test('em inglês os tipos e as câmaras aparecem traduzidos', () => {
        boxType('bandpass');
        renderWithProviders(<BoxPanel />, 'en');

        expect(screen.getByRole('radio', { name: 'Bandpass' })).toBeVisible();
        expect(screen.getByRole('radio', { name: 'Sealed' })).toBeVisible();
        expect(screen.getByRole('radio', { name: 'Vented' })).toBeVisible();
        expect(
            screen.getByRole('textbox', { name: /^Vr/ }),
        ).toHaveAccessibleName(/Rear chamber volume/);
        expect(
            screen.getByRole('textbox', { name: /^Vf/ }),
        ).toHaveAccessibleName(/Front chamber volume/);
    });

    test('no sistema imperial as câmaras mostram ft³', () => {
        usePreferences.setState({ unitSystem: 'imperial' });
        act(() => {
            const box = activeProjectStore().getState();
            box.apply((data) => ({
                ...data,
                box: {
                    ...data.box,
                    type: 'bandpass',
                    vr_m3: 0.04,
                    vf_m3: 0.06,
                },
            }));
        });
        renderWithProviders(<BoxPanel />);

        // 0,04 m³ = 1,41 ft³ e 0,06 m³ = 2,12 ft³
        expect(screen.getByRole('textbox', { name: /^Vr/ })).toHaveValue(
            '1,41',
        );
        expect(screen.getByRole('textbox', { name: /^Vf/ })).toHaveValue(
            '2,12',
        );
        expect(
            screen.getAllByRole('button', { name: /trocar unidade de V[rf]/ }),
        ).toHaveLength(2);
    });

    test('trocar a unidade de um volume grava em fieldUnits só daquele campo', async () => {
        act(() => {
            activeProjectStore()
                .getState()
                .apply((data) => ({
                    ...data,
                    box: {
                        ...data.box,
                        type: 'bandpass',
                        vr_m3: 0.04,
                        vf_m3: 0.06,
                    },
                }));
        });
        renderWithProviders(<BoxPanel />);

        await userEvent.click(
            screen.getByRole('button', { name: /trocar unidade de Vr/ }),
        );
        await userEvent.click(
            screen.getByRole('menuitemradio', { name: 'ft³' }),
        );

        expect(activeProjectStore().getState().data.fieldUnits).toEqual({
            vr_m3: 'ft3',
        });
        expect(screen.getByRole('textbox', { name: /^Vr/ })).toHaveValue(
            '1,41',
        );
        expect(screen.getByRole('textbox', { name: /^Vf/ })).toHaveValue(
            '60,0',
        );
        expect(activeProjectStore().getState().data.box.vr_m3).toBe(0.04);
    });
});
