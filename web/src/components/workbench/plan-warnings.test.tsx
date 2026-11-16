import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vite-plus/test';
import type { Plan } from '@/cutplan';
import { usePreferences } from '@/stores/preferences';
import { renderWithProviders } from '@/test/render';
import { PlanWarnings } from './plan-warnings';

const PLAN: Plan = {
    boxType: 'vented',
    thickness_m: 0.018,
    dimensions: {
        internal: { w_m: 0.4, h_m: 0.6, d_m: 0.25 },
        external: { w_m: 0.436, h_m: 0.636, d_m: 0.286 },
    },
    pieces: [],
    port_length_m: 0.4,
    volume: { chambers: [] },
    warnings: [
        { id: 'driverCutoutUnknown', tone: 'info', key: 'cutout_m' },
        { id: 'cutoutTight', tone: 'warn', piece: 'front' },
        { id: 'cutoutTooBig', tone: 'error', piece: 'front' },
    ],
};

describe('PlanWarnings', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('mostra erro antes de atenção antes de informação', () => {
        renderWithProviders(<PlanWarnings plan={PLAN} />);

        const items = within(
            screen.getByRole('list', { name: 'Avisos do plano' }),
        ).getAllByRole('listitem');

        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent(/não cabe no lado menor/);
        expect(items[1]).toHaveTextContent(/Sobra pouca madeira/);
        expect(items[2]).toHaveTextContent(
            /diâmetro do recorte do alto-falante/,
        );
    });

    test('cada aviso nomeia a peça ou o campo', () => {
        renderWithProviders(<PlanWarnings plan={PLAN} />);

        expect(screen.getByText(/lado menor de frente/)).toBeVisible();
        expect(screen.getByText(/\(Ød\)/)).toBeVisible();
    });

    test('o aviso de dobra cita o comprimento e a profundidade nas unidades ativas', () => {
        renderWithProviders(
            <PlanWarnings
                plan={{
                    ...PLAN,
                    warnings: [{ id: 'portLongerThanDepth', tone: 'warn' }],
                }}
            />,
        );

        expect(screen.getByText(/400,0 mm.*250,0 mm/)).toBeVisible();
    });

    test('sem avisos não desenha nada', () => {
        const { container } = renderWithProviders(
            <PlanWarnings plan={{ ...PLAN, warnings: [] }} />,
        );

        expect(container).toBeEmptyDOMElement();
    });
});

describe('PlanWarnings — bandpass de 6ª ordem', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    const SIXTH: Plan = {
        ...PLAN,
        boxType: 'bandpass6',
        dimensions: {
            ...PLAN.dimensions,
            chambers: { rear_d_m: 0.15, front_d_m: 0.1 },
        },
        warnings: [
            {
                id: 'portLongerThanDepth',
                tone: 'warn',
                duct: 'rear',
                length_m: 0.3,
                depth_m: 0.15,
            },
            { id: 'portUnknown', tone: 'info', duct: 'front' },
        ],
    };

    test('o aviso de dobra nomeia o duto e usa o comprimento e a profundidade da câmara dele', () => {
        renderWithProviders(<PlanWarnings plan={SIXTH} />);

        expect(
            screen.getByText(
                /O duto traseiro \(300.* mm\) é mais longo que a profundidade da câmara traseira \(150.* mm\)/,
            ),
        ).toBeVisible();
    });

    test('duto sem medidas nomeia a câmara', () => {
        renderWithProviders(<PlanWarnings plan={SIXTH} />);

        expect(
            screen.getByText(/duto da câmara frontal está sem medidas/),
        ).toBeVisible();
    });

    test('em inglês também', () => {
        renderWithProviders(<PlanWarnings plan={SIXTH} />, 'en');

        expect(
            screen.getByText(
                /The rear port .* longer than the rear chamber depth/,
            ),
        ).toBeVisible();
    });
});

describe('PlanWarnings — posição dos recortes', () => {
    beforeEach(() => {
        usePreferences.setState({ unitSystem: 'metric' });
    });

    test('cada aviso nomeia o recorte e a peça; dois recortes com o mesmo aviso não se misturam', () => {
        renderWithProviders(
            <PlanWarnings
                plan={{
                    ...PLAN,
                    warnings: [
                        {
                            id: 'cutoutOverlap',
                            tone: 'warn',
                            piece: 'front',
                            cutout: { piece: 'front', kind: 'driver', n: 1 },
                        },
                        {
                            id: 'cutoutOverlap',
                            tone: 'warn',
                            piece: 'front',
                            cutout: { piece: 'front', kind: 'port', n: 1 },
                        },
                        {
                            id: 'cutoutOutside',
                            tone: 'error',
                            piece: 'back',
                            cutout: { piece: 'back', kind: 'port', n: 1 },
                        },
                    ],
                }}
            />,
        );

        const items = screen.getAllByRole('listitem');

        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent('Duto 1 passa da borda de fundo');
        expect(items[1]).toHaveTextContent(/^Alto-falante 1 em frente encosta/);
        expect(items[2]).toHaveTextContent(/^Duto 1 em frente encosta/);
    });
});
