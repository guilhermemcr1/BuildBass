import { act, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { writeField } from '@/lib/project/fields';
import { usePreferences } from '@/stores/preferences';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { renderWithProviders } from '@/test/render';
import { PrintSheet } from './print-sheet';

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

describe('PrintSheet', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('não desenha nada enquanto o plano está bloqueado', () => {
        setField('vb_m3', undefined);
        const { container } = renderWithProviders(<PrintSheet />);

        expect(container).toBeEmptyDOMElement();
    });

    test('é oculta na tela e visível só na impressão', () => {
        setField('vb_m3', 0.06);
        const { container } = renderWithProviders(<PrintSheet />);
        const sheet = container.querySelector('[data-print-sheet]');

        expect(sheet).not.toBeNull();
        expect(sheet?.className).toContain('hidden');
        expect(sheet?.className).toContain('print:flex');
    });

    test('traz nome do projeto, dimensões, peças, desenhos e a convenção', () => {
        setField('vb_m3', 0.06);
        const { container } = renderWithProviders(<PrintSheet />);
        const sheet = container.querySelector(
            '[data-print-sheet]',
        ) as HTMLElement;
        const inside = within(sheet);

        expect(
            inside.getByRole('heading', {
                name: /Plano de corte: /,
                hidden: true,
            }),
        ).toBeInTheDocument();
        expect(
            inside.getByRole('table', { name: 'Dimensões', hidden: true }),
        ).toBeInTheDocument();
        expect(
            inside.getByRole('table', { name: /Lista de corte/, hidden: true }),
        ).toBeInTheDocument();
        expect(
            inside.getAllByRole('img', { hidden: true }).length,
        ).toBeGreaterThanOrEqual(5);
        expect(inside.getByText(/Convenção de montagem/)).toBeInTheDocument();
    });

    test('inclui a conferência e os avisos quando existem', () => {
        setField('vb_m3', 0.06);
        const { container } = renderWithProviders(<PrintSheet />);
        const sheet = container.querySelector(
            '[data-print-sheet]',
        ) as HTMLElement;

        expect(
            within(sheet).getByText(/diâmetro do recorte do driver/),
        ).toBeInTheDocument();
    });

    test('não tem vista 3D nem botões', () => {
        setField('vb_m3', 0.06);
        const { container } = renderWithProviders(<PrintSheet />);
        const sheet = container.querySelector(
            '[data-print-sheet]',
        ) as HTMLElement;

        expect(sheet.querySelector('[data-yaw]')).toBeNull();
        expect(sheet.querySelector('button')).toBeNull();
        expect(screen.queryByText('Ver por dentro')).toBeNull();
    });
});
