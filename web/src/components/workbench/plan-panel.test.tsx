import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
} from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { writeField } from '@/lib/project/fields';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { PlanPanel } from './plan-panel';

function setField(
    key: Parameters<typeof writeField>[1],
    si: number | undefined,
) {
    act(() =>
        activeProjectStore()
            .getState()
            .apply((data) => writeField(data, key, si)),
    );
}

describe('PlanPanel', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('sem volume avisa o que falta, citando o símbolo do campo', () => {
        setField('vb_m3', undefined);
        renderWithProviders(<PlanPanel />);

        expect(
            screen.getByText(/Faltam parâmetros para o plano: .*Vb/),
        ).toBeVisible();
        expect(screen.queryByRole('table')).toBeNull();
    });

    test('com volume mostra dimensões e a lista de peças', () => {
        setField('vb_m3', 0.06);
        renderWithProviders(<PlanPanel />);

        expect(
            screen.getByRole('region', { name: 'Plano de corte' }),
        ).toBeVisible();
        expect(screen.getByRole('table')).toBeVisible();
        expect(screen.getByRole('row', { name: /Frente/ })).toBeVisible();
        expect(screen.getByText(/Internas · Largura/)).toBeVisible();
        expect(screen.getByText(/Externas · Altura/)).toBeVisible();
    });

    test('mudar a espessura atualiza a tabela', async () => {
        setField('vb_m3', 0.06);
        renderWithProviders(<PlanPanel />);
        const row = () => screen.getByRole('row', { name: /Lateral/ });

        expect(within(row()).getAllByRole('cell')[4]).toHaveTextContent('18');

        const field = screen.getByRole('textbox', { name: /Espessura/ });
        await userEvent.clear(field);
        await userEvent.type(field, '25{Enter}');

        expect(within(row()).getAllByRole('cell')[4]).toHaveTextContent('25');
    });

    test('proporção própria mostra os três lados para editar', async () => {
        setField('vb_m3', 0.06);
        renderWithProviders(<PlanPanel />);

        expect(screen.queryByRole('textbox', { name: /^Rh/ })).toBeNull();
        expect(
            screen.getByText(/Altura : largura : profundidade/),
        ).toBeVisible();

        await userEvent.click(
            screen.getByRole('button', { name: /Proporção/ }),
        );
        await userEvent.click(screen.getByRole('option', { name: 'Própria' }));

        expect(screen.getByRole('textbox', { name: /^Rh/ })).toBeVisible();
        expect(screen.getByRole('textbox', { name: /^Rw/ })).toBeVisible();
        expect(screen.getByRole('textbox', { name: /^Rd/ })).toBeVisible();
    });

    test('bandpass mostra a divisória, as profundidades das câmaras e a conferência de duas câmaras', () => {
        act(() => activeProjectStore().getState().setBoxType('bandpass'));
        setField('vr_m3', 0.04);
        setField('vf_m3', 0.06);
        renderWithProviders(<PlanPanel />);

        const divider = screen.getByRole('row', { name: /Divisória/ });

        expect(within(divider).getByText('Entre as câmaras')).toBeVisible();
        expect(
            screen.getByText('Profundidade da câmara traseira'),
        ).toBeVisible();
        expect(
            screen.getByText('Profundidade da câmara frontal'),
        ).toBeVisible();
        expect(
            screen
                .getByRole('table', { name: /Lista de corte/ })
                .querySelectorAll('tbody tr'),
        ).toHaveLength(6);
    });

    test('selada e dutada não mostram as profundidades por câmara', () => {
        setField('vb_m3', 0.06);
        renderWithProviders(<PlanPanel />);

        expect(
            screen.queryByText('Profundidade da câmara traseira'),
        ).toBeNull();
        expect(screen.queryByRole('row', { name: /Divisória/ })).toBeNull();
    });

    test('só ver o plano não cria cutPlan; voltar ao valor padrão mantém o campo', () => {
        setField('vb_m3', 0.06);
        const before = activeProjectStore().getState().data;
        renderWithProviders(<PlanPanel />);

        expect(activeProjectStore().getState().data).toBe(before);
        expect(activeProjectStore().getState().data).not.toHaveProperty(
            'cutPlan',
        );

        setField('thickness_m', 0.025);
        setField('thickness_m', 0.018);

        expect(activeProjectStore().getState().data.cutPlan).toEqual({
            thickness_m: 0.018,
        });

        setField('thickness_m', undefined);

        expect(activeProjectStore().getState().data).not.toHaveProperty(
            'cutPlan',
        );
    });

    describe('idioma e unidades (US7)', () => {
        test('em inglês os rótulos, cabeçalhos, peças e avisos aparecem traduzidos', () => {
            setField('vb_m3', 0.06);
            renderWithProviders(<PlanPanel />, 'en');

            expect(
                screen.getByRole('region', { name: 'Cut plan' }),
            ).toBeVisible();
            expect(
                screen.getByRole('table', { name: /Cut list for/ }),
            ).toBeVisible();

            for (const name of [
                'Piece',
                'Position',
                'Qty',
                'Length',
                'Width',
                'Thickness',
                'Cutouts',
            ]) {
                expect(
                    screen.getByRole('columnheader', { name }),
                ).toBeVisible();
            }

            expect(screen.getByRole('row', { name: /Front/ })).toBeVisible();
            expect(screen.getByRole('row', { name: /Side/ })).toBeVisible();
            expect(screen.getByText('Internal · Width')).toBeVisible();
            expect(
                screen.getByText(/The driver cutout diameter/),
            ).toBeVisible();
            expect(
                screen.getByRole('button', { name: 'Export CSV' }),
            ).toBeVisible();
            expect(screen.getByRole('button', { name: 'Print' })).toBeVisible();
        });

        test('em inglês as proporções têm nome e a razão sai com ponto decimal', () => {
            setField('vb_m3', 0.06);
            renderWithProviders(<PlanPanel />, 'en');

            expect(
                screen.getByText('Height : width : depth = 2.62 : 1.62 : 1.00'),
            ).toBeVisible();
        });

        test('no sistema imperial a espessura sai em polegadas e os reforços em ft³', () => {
            usePreferences.setState({ unitSystem: 'imperial' });
            setField('vb_m3', 0.06);
            renderWithProviders(<PlanPanel />);

            const thickness = screen.getByRole('textbox', {
                name: /Espessura/,
            });
            const braces = screen.getByRole('textbox', {
                name: /Volume dos reforços/,
            });

            expect(thickness).toHaveValue('0,709');
            expect(
                screen.getByRole('button', {
                    name: /in — trocar unidade de t/,
                }),
            ).toBeVisible();
            expect(
                screen.getByRole('button', {
                    name: /ft³ — trocar unidade de Vrf/,
                }),
            ).toBeVisible();
            expect(braces).toHaveValue('0,00');
        });

        test('trocar a unidade de um campo grava em fieldUnits e não muda o valor SI', async () => {
            setField('vb_m3', 0.06);
            setField('thickness_m', 0.025);
            renderWithProviders(<PlanPanel />);

            await userEvent.click(
                screen.getByRole('button', {
                    name: /mm — trocar unidade de t/,
                }),
            );
            await userEvent.click(
                screen.getByRole('menuitemradio', { name: 'in' }),
            );

            const { data } = activeProjectStore().getState();

            expect(data.fieldUnits.thickness_m).toBe('in');
            expect(data.fieldUnits.braces_m3).toBeUndefined();
            expect(data.fieldUnits.cutout_m).toBeUndefined();
            expect(data.cutPlan?.thickness_m).toBe(0.025);
            expect(
                screen.getByRole('textbox', { name: /Espessura/ }),
            ).toHaveValue('0,984');
        });
    });

    describe('exportar e imprimir', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        test('com o plano bloqueado os botões ficam desativados e dizem por quê', () => {
            setField('vb_m3', undefined);
            renderWithProviders(<PlanPanel />);

            for (const name of ['Exportar CSV', 'Imprimir']) {
                const button = screen.getByRole('button', { name });

                expect(button).toBeDisabled();
                expect(button).toHaveAccessibleDescription(
                    /Disponível quando o plano estiver completo/,
                );
            }
        });

        test('com o plano pronto, Exportar CSV baixa o arquivo e Imprimir abre a impressão', async () => {
            setField('vb_m3', 0.06);
            const blobs: Blob[] = [];
            vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
                blobs.push(blob as Blob);

                return 'blob:test';
            });
            vi.spyOn(URL, 'revokeObjectURL').mockImplementation(
                () => undefined,
            );
            const click = vi
                .spyOn(HTMLAnchorElement.prototype, 'click')
                .mockImplementation(() => undefined);
            const print = vi
                .spyOn(window, 'print')
                .mockImplementation(() => undefined);
            renderWithProviders(<PlanPanel />);

            await userEvent.click(
                screen.getByRole('button', { name: 'Exportar CSV' }),
            );
            expect(click).toHaveBeenCalledTimes(1);
            expect(blobs[0].type).toBe('text/csv;charset=utf-8');
            expect(await blobs[0].text()).toContain('Frente');

            await userEvent.click(
                screen.getByRole('button', { name: 'Imprimir' }),
            );
            expect(print).toHaveBeenCalledTimes(1);
        });
    });
});
