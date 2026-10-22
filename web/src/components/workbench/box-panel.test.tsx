import { act, screen, within } from '@testing-library/react';
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

    test('o seletor tem os quatro tipos, todos ativos, e não avisa que a bandpass não existe', () => {
        renderWithProviders(<BoxPanel />);

        for (const name of [
            'Selada',
            'Dutada',
            'Bandpass 4ª ordem',
            'Bandpass 6ª ordem',
        ]) {
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

    test('escolher Bandpass 4ª ou 6ª ordem muda o tipo do projeto ativo', async () => {
        renderWithProviders(<BoxPanel />);

        await userEvent.click(
            screen.getByRole('radio', { name: 'Bandpass 4ª ordem' }),
        );
        expect(activeProjectStore().getState().data.box.type).toBe('bandpass');

        await userEvent.click(
            screen.getByRole('radio', { name: 'Bandpass 6ª ordem' }),
        );
        expect(activeProjectStore().getState().data.box.type).toBe('bandpass6');
    });

    test('em inglês os tipos e as câmaras aparecem traduzidos', () => {
        boxType('bandpass');
        renderWithProviders(<BoxPanel />, 'en');

        expect(
            screen.getByRole('radio', { name: '4th-order bandpass' }),
        ).toBeVisible();
        expect(
            screen.getByRole('radio', { name: '6th-order bandpass' }),
        ).toBeVisible();
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

describe('BoxPanel — bandpass de 6ª ordem', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('mostra as duas câmaras dutadas, cada uma com volume, sintonia e grupo de duto', () => {
        boxType('bandpass6');
        renderWithProviders(<BoxPanel />);

        const rear = screen.getByRole('group', {
            name: 'Câmara traseira (dutada)',
        });
        const front = screen.getByRole('group', {
            name: 'Câmara frontal (dutada)',
        });

        expect(
            within(rear).getByRole('textbox', { name: /^Vr/ }),
        ).toBeVisible();
        expect(
            within(rear).getByRole('textbox', { name: /^Fbr/ }),
        ).toBeVisible();
        expect(
            within(rear).getByRole('group', { name: 'Duto (câmara traseira)' }),
        ).toBeVisible();
        expect(
            within(front).getByRole('textbox', { name: /^Vf/ }),
        ).toBeVisible();
        expect(
            within(front).getByRole('textbox', { name: /^Fb$|^Fb\b/ }),
        ).toBeVisible();
        expect(
            within(front).getByRole('group', { name: 'Duto (câmara frontal)' }),
        ).toBeVisible();
        expect(screen.getByRole('textbox', { name: /^Ql/ })).toBeVisible();
        expect(screen.queryByRole('textbox', { name: /^Vb/ })).toBeNull();
    });

    test('Sugerir caixa fica desativado com o motivo da bandpass', () => {
        boxType('bandpass6');
        renderWithProviders(<BoxPanel />);

        expect(
            screen.getByRole('button', { name: 'Sugerir caixa' }),
        ).toBeDisabled();
        expect(
            screen.getByText(/Sugestão disponível só para caixa selada/),
        ).toBeVisible();
    });

    test('a 4ª ordem não mostra Fbr nem o duto traseiro', () => {
        boxType('bandpass');
        renderWithProviders(<BoxPanel />);

        expect(screen.queryByRole('textbox', { name: /^Fbr/ })).toBeNull();
        expect(screen.queryByText('Duto (câmara traseira)')).toBeNull();
    });

    test('digitar em Fbr grava só fb_rear_hz', async () => {
        boxType('bandpass6');
        renderWithProviders(<BoxPanel />);

        const before = activeProjectStore().getState().data.box;
        await userEvent.type(
            screen.getByRole('textbox', { name: /^Fbr/ }),
            '32',
        );
        await userEvent.tab();

        const after = activeProjectStore().getState().data.box;
        expect(after.fb_rear_hz).toBe(32);
        expect(after.fb_hz).toBe(before.fb_hz);
    });

    test('unidade por campo do duto traseiro é independente da do frontal', async () => {
        act(() => {
            activeProjectStore()
                .getState()
                .apply((data) => ({
                    ...data,
                    box: {
                        ...data.box,
                        type: 'bandpass6',
                        port: { shape: 'round', diameter_m: 0.1, count: 1 },
                        port_rear: {
                            shape: 'round',
                            diameter_m: 0.1,
                            count: 1,
                        },
                    },
                }));
        });
        renderWithProviders(<BoxPanel />);

        const rear = screen.getByRole('group', {
            name: 'Duto (câmara traseira)',
        });
        await userEvent.click(
            within(rear).getAllByRole('button', { name: /trocar unidade/ })[0],
        );
        await userEvent.click(
            screen.getByRole('menuitemradio', { name: 'in' }),
        );

        const { fieldUnits } = activeProjectStore().getState().data;
        expect(fieldUnits.rear_diameter_m).toBe('in');
        expect(fieldUnits.diameter_m).toBeUndefined();
    });

    test('em inglês a 6ª ordem aparece traduzida, sem texto fixo', () => {
        boxType('bandpass6');
        renderWithProviders(<BoxPanel />, 'en');

        expect(
            screen.getByRole('group', { name: 'Rear chamber (ported)' }),
        ).toBeVisible();
        expect(
            screen.getByRole('group', { name: 'Front chamber (ported)' }),
        ).toBeVisible();
        expect(
            screen.getByRole('group', { name: 'Port (rear chamber)' }),
        ).toBeVisible();
        expect(
            screen.getByRole('group', { name: 'Port (front chamber)' }),
        ).toBeVisible();
        expect(
            screen.getByRole('textbox', { name: /^Fbr/ }),
        ).toHaveAccessibleName(/Rear chamber tuning|rear/i);
    });

    test('no sistema imperial os volumes e os dois dutos usam ft³ e pol, e a troca por campo funciona', async () => {
        usePreferences.setState({ unitSystem: 'imperial' });
        act(() => {
            activeProjectStore()
                .getState()
                .apply((data) => ({
                    ...data,
                    box: {
                        ...data.box,
                        type: 'bandpass6',
                        vr_m3: 0.08,
                        vf_m3: 0.04,
                        fb_hz: 45,
                        fb_rear_hz: 30,
                        port: { shape: 'round', diameter_m: 0.1, count: 1 },
                        port_rear: {
                            shape: 'round',
                            diameter_m: 0.08,
                            count: 1,
                        },
                    },
                }));
        });
        renderWithProviders(<BoxPanel />);

        // 0,08 m³ = 2,83 ft³; 0,04 m³ = 1,41 ft³; 0,08 m = 3,15 pol; 0,1 m = 3,94 pol.
        expect(screen.getByRole('textbox', { name: /^Vr/ })).toHaveValue(
            '2,83',
        );
        expect(screen.getByRole('textbox', { name: /^Vf/ })).toHaveValue(
            '1,41',
        );
        const rear = screen.getByRole('group', {
            name: 'Duto (câmara traseira)',
        });
        const front = screen.getByRole('group', {
            name: 'Duto (câmara frontal)',
        });
        expect(
            within(rear).getByRole('textbox', { name: /Diâmetro do duto/ }),
        ).toHaveValue('3,150');
        expect(
            within(front).getByRole('textbox', { name: /Diâmetro do duto/ }),
        ).toHaveValue('3,937');

        // Trocar a unidade do duto traseiro não mexe no frontal.
        await userEvent.click(
            within(rear).getAllByRole('button', { name: /trocar unidade/ })[0],
        );
        await userEvent.click(
            screen.getByRole('menuitemradio', { name: 'mm' }),
        );

        expect(
            within(rear).getByRole('textbox', { name: /Diâmetro do duto/ }),
        ).toHaveValue('80,0');
        expect(
            within(front).getByRole('textbox', { name: /Diâmetro do duto/ }),
        ).toHaveValue('3,937');
    });
});

describe('BoxPanel — modal da caixa (feature 008, US4)', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('a miniatura abre o modal', async () => {
        renderWithProviders(<BoxPanel />);

        await userEvent.click(
            await screen.findByRole('button', { name: 'Ver caixa em 3D' }),
        );

        expect(
            await screen.findByRole('dialog', { name: 'Caixa' }),
        ).toBeVisible();
    });

    test('o botão de ícone do título também abre o modal', async () => {
        renderWithProviders(<BoxPanel />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Ampliar caixa' }),
        );

        expect(
            await screen.findByRole('dialog', { name: 'Caixa' }),
        ).toBeVisible();
    });

    test('digitar ou clicar nos campos do painel não abre o modal', async () => {
        boxType('vented');
        renderWithProviders(<BoxPanel />);
        const vb = screen.getByRole('textbox', { name: /^Vb/ });

        await userEvent.click(vb);
        await userEvent.type(vb, '50{Enter}');
        await userEvent.click(screen.getByRole('radio', { name: 'Selada' }));

        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
