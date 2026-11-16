import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { PortFields } from './port-fields';

function sixth() {
    act(() => {
        activeProjectStore()
            .getState()
            .apply((data) => ({
                ...data,
                box: {
                    ...data.box,
                    type: 'bandpass6',
                    port: { shape: 'round', diameter_m: 0.1, count: 1 },
                    port_rear: { shape: 'round', diameter_m: 0.08, count: 1 },
                },
            }));
    });
}

describe('PortFields', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('duct="rear" tem o título e os campos do duto traseiro', () => {
        sixth();
        renderWithProviders(<PortFields duct="rear" />);

        const group = screen.getByRole('group', {
            name: 'Duto (câmara traseira)',
        });
        // 0,08 m = 80 mm: vem de rear_diameter_m, não do duto frontal.
        expect(
            within(group).getByRole('textbox', { name: /Diâmetro do duto/ }),
        ).toHaveValue('80,0');
    });

    test('duct="front" lê o duto frontal', () => {
        sixth();
        renderWithProviders(<PortFields duct="front" />);

        const group = screen.getByRole('group', {
            name: 'Duto (câmara frontal)',
        });
        expect(
            within(group).getByRole('textbox', { name: /Diâmetro do duto/ }),
        ).toHaveValue('100,0');
    });

    test('trocar o formato de um duto não altera o outro', async () => {
        sixth();
        renderWithProviders(<PortFields duct="rear" />);

        await userEvent.click(
            screen.getByRole('radio', { name: 'Retangular' }),
        );

        const { box } = activeProjectStore().getState().data;
        expect(box.port_rear?.shape).toBe('rect');
        expect(box.port.shape).toBe('round');
    });

    test('a quantidade vai de 1 a 8 em cada duto, sem mexer no outro', async () => {
        sixth();
        renderWithProviders(<PortFields duct="rear" />);

        const count = screen.getByRole('textbox', {
            name: /Quantidade de dutos/,
        });
        await userEvent.clear(count);
        await userEvent.type(count, '3');
        await userEvent.tab();

        let { box } = activeProjectStore().getState().data;
        expect(box.port_rear?.count).toBe(3);
        expect(box.port.count).toBe(1);

        await userEvent.clear(count);
        await userEvent.type(count, '9');
        await userEvent.tab();

        ({ box } = activeProjectStore().getState().data);
        expect(box.port_rear?.count).toBeLessThanOrEqual(8);
    });

    test('sem duto traseiro definido o formulário começa redondo e vazio', () => {
        act(() => activeProjectStore().getState().setBoxType('bandpass6'));
        act(() =>
            activeProjectStore()
                .getState()
                .apply((data) => ({
                    ...data,
                    box: { ...data.box, port_rear: undefined },
                })),
        );
        renderWithProviders(<PortFields duct="rear" />);

        expect(screen.getByRole('radio', { name: 'Redondo' })).toBeChecked();
    });
});

describe('PortFields — pontas do duto', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    const port = () => activeProjectStore().getState().data.box.port;
    const choose = async (option: string) => {
        await userEvent.click(
            screen.getByRole('button', { name: /Pontas do duto/ }),
        );
        await userEvent.click(screen.getByRole('option', { name: option }));
    };

    test('padrão flangeada + livre, sem nada gravado no duto', () => {
        renderWithProviders(<PortFields />);

        expect(
            screen.getByRole('button', { name: /Pontas do duto/ }),
        ).toHaveTextContent('Uma flangeada, uma livre (padrão)');
        expect(port().end).toBeUndefined();
    });

    test('slot na parede grava a escolha; o fator só aparece em "Fator próprio"', async () => {
        renderWithProviders(<PortFields />);

        await choose('Slot encostado na parede');
        expect(port().end).toBe('slotWall');
        expect(
            screen.queryByLabelText(/Fator da correção de ponta/),
        ).toBeNull();

        await choose('Fator próprio');
        expect(port().end).toBe('custom');
        expect(
            screen.getByLabelText(/Fator da correção de ponta/),
        ).toBeVisible();

        await choose('Uma flangeada, uma livre (padrão)');
        expect(port().end).toBeUndefined();
    });

    test('trocar o formato mantém a ponta escolhida', async () => {
        renderWithProviders(<PortFields />);

        await choose('Duas livres');
        await userEvent.click(
            screen.getByRole('radio', { name: 'Retangular' }),
        );

        expect(port()).toMatchObject({ shape: 'rect', end: 'free' });
    });
});
