import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import { activeProjectStore } from '@/hooks/use-active-project';
import { renderWithProviders } from '@/test/render';
import { initialWorkspace, useWorkspace } from '@/stores/workspace';
import { DriverPanel } from './driver-panel';

function field(symbol: string) {
    return screen.getByRole('textbox', { name: new RegExp(`^${symbol}\\s?—`) });
}

describe('DriverPanel — consistência e calculados (US4)', () => {
    beforeEach(() => {
        localStorage.clear();
        useWorkspace.setState(initialWorkspace());
    });

    test('Qes e Qms digitados mostram o Qts calculado, apagado', () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        act(() => {
            const { setDriverValue } = activeProjectStore().getState();
            setDriverValue('qes', 0.42);
            setDriverValue('qms', 4.1);
        });

        const qts = field('Qts');
        expect(qts).toHaveValue('0,38');
        expect(qts).toHaveClass('text-muted');
        expect(qts.closest('[class*="group"]')).toHaveTextContent('calculado');
    });

    test('Qts divergente cita a relação e o percentual', () => {
        renderWithProviders(<DriverPanel onSubmitDriver={() => undefined} />);
        act(() => {
            const { setDriverValue } = activeProjectStore().getState();
            setDriverValue('qes', 0.42);
            setDriverValue('qms', 4.1);
            setDriverValue('qts', 0.42);
        });

        expect(
            screen.getAllByText(
                /Diferença de 10,2\s?% em Qts = Qes·Qms \/ \(Qes \+ Qms\)/,
            ),
        ).toHaveLength(3);
        expect(field('Qts')).toHaveClass('text-foreground');
    });
});
