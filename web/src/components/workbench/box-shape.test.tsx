import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { resolveCutPlan } from '@/cutplan';
import { writeField } from '@/lib/project/fields';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { BoxShape } from './box-shape';

function setVolume(si: number) {
    act(() =>
        activeProjectStore()
            .getState()
            .apply((data) => writeField(data, 'vb_m3', si)),
    );
}

const height = () => screen.getByRole('textbox', { name: /^Hi —/ });
const width = () => screen.getByRole('textbox', { name: /^Wi —/ });
const depth = () => screen.getByRole('textbox', { name: /^Di —/ });
const mm = (field: HTMLElement) =>
    Number((field as HTMLInputElement).value.replace(',', '.'));

describe('BoxShape', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({
            unitSystem: 'metric',
            boxMeasure: undefined,
        });
    });

    test('externas: mostra as medidas por fora e grava a interna sem as duas chapas', async () => {
        setVolume(0.06);
        renderWithProviders(<BoxShape />);
        const wall = 2 * resolveCutPlan(undefined).thickness_m * 1000;

        expect(screen.getByText('Medidas internas')).toBeVisible();
        await userEvent.click(screen.getByRole('radio', { name: 'Externas' }));

        expect(usePreferences.getState().boxMeasure).toBe('external');
        expect(screen.getByText('Medidas externas')).toBeVisible();
        const outerHeight = () =>
            screen.getByRole('textbox', { name: /^Medida externa.*Hi/ });
        expect(mm(outerHeight())).toBeCloseTo(633.4 + wall, 1);

        await userEvent.clear(outerHeight());
        await userEvent.type(outerHeight(), '700{Enter}');
        expect(outerHeight()).toHaveValue('700,0');

        await userEvent.click(screen.getByRole('radio', { name: 'Internas' }));
        expect(mm(height())).toBeCloseTo(700 - wall, 1);
    });

    test('mostra as três medidas internas em mm, editáveis, da proporção escolhida', () => {
        setVolume(0.06);
        renderWithProviders(<BoxShape />);

        expect(height()).toHaveValue('633,4');
        expect(width()).toHaveValue('391,5');
        expect(depth()).toHaveValue('242,0');
        expect(height()).toBeEnabled();
        expect(screen.getAllByText('mm').length).toBeGreaterThanOrEqual(3);
    });

    test('editar a altura vale como digitado, ajusta as outras duas e mantém o volume', async () => {
        setVolume(0.06);
        renderWithProviders(<BoxShape />);

        await userEvent.clear(height());
        await userEvent.type(height(), '700{Enter}');

        expect(height()).toHaveValue('700,0');
        expect(
            screen.getByRole('button', { name: /Personalizada/ }),
        ).toBeVisible();
        expect(mm(width())).toBeLessThan(391.5);
        expect(mm(depth())).toBeLessThan(242);
        // 60 L = 60 000 000 mm³
        expect(
            (mm(height()) * mm(width()) * mm(depth())) / 1_000_000,
        ).toBeCloseTo(60, 0);
    });

    test('sem volume os campos ficam desativados e o texto diz o que informar', () => {
        renderWithProviders(<BoxShape />);

        expect(height()).toBeDisabled();
        expect(screen.getByText(/Informe o volume/)).toBeVisible();
    });

    test('em inglês as medidas saem com ponto decimal', () => {
        setVolume(0.06);
        renderWithProviders(<BoxShape />, 'en');

        expect(height()).toHaveValue('633.4');
    });
});
