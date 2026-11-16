import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import type { VolumeCheck as VolumeCheckData } from '@/cutplan';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { VolumeCheck } from './volume-check';

const MAIN = {
    id: 'main' as const,
    internal_m3: 0.063,
    braces_m3: 0.003,
    drivers_m3: 0.004,
    ports_m3: 0,
    net_m3: 0.056,
    simulated_m3: 0.056,
    difference_ratio: 0,
};

const BANDPASS: VolumeCheckData = {
    chambers: [
        { ...MAIN, id: 'rear' },
        { ...MAIN, id: 'front', drivers_m3: 0, ports_m3: 0.002 },
    ],
    matchesSimulation: true,
};

describe('VolumeCheck', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('mostra as sete linhas por câmara, em litros', () => {
        renderWithProviders(<VolumeCheck volume={BANDPASS} />);

        const table = screen.getByRole('table', { name: /em L/ });

        for (const name of [
            'Interno',
            'Reforços',
            'Alto-falantes',
            'Dutos',
            'Líquido',
            'Simulado',
            'Diferença',
        ]) {
            expect(
                within(table).getByRole('rowheader', { name }),
            ).toBeInTheDocument();
        }

        expect(
            within(table).getByRole('columnheader', {
                name: 'Câmara traseira',
            }),
        ).toBeInTheDocument();
        expect(
            within(table).getByRole('columnheader', { name: 'Câmara frontal' }),
        ).toBeInTheDocument();
        expect(
            within(
                within(table).getByRole('row', { name: /Interno/ }),
            ).getAllByRole('cell')[0],
        ).toHaveTextContent('63');
    });

    test('igual à simulação aparece com texto', () => {
        renderWithProviders(<VolumeCheck volume={BANDPASS} />);

        expect(screen.getByText(/Igual à simulação/)).toBeVisible();
    });

    test('diferente da simulação também é dito em texto', () => {
        renderWithProviders(
            <VolumeCheck
                volume={{ chambers: [MAIN], matchesSimulation: false }}
            />,
        );

        expect(screen.getByText('Diferente da simulação.')).toBeVisible();
    });

    test('sem conferência não afirma nada e mostra traço no simulado', () => {
        const { simulated_m3: _s, difference_ratio: _d, ...open } = MAIN;
        renderWithProviders(<VolumeCheck volume={{ chambers: [open] }} />);

        expect(screen.queryByText(/Igual à simulação/)).toBeNull();
        expect(
            within(screen.getByRole('row', { name: /Simulado/ })).getAllByRole(
                'cell',
            )[0],
        ).toHaveTextContent('—');
    });

    test('no sistema imperial usa ft³', () => {
        usePreferences.setState({ unitSystem: 'imperial' });
        renderWithProviders(<VolumeCheck volume={BANDPASS} />);

        expect(screen.getByRole('table', { name: /em ft³/ })).toBeVisible();
    });

    test('sem câmaras não desenha nada', () => {
        const { container } = renderWithProviders(
            <VolumeCheck volume={{ chambers: [] }} />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});
